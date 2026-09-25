import { Request, Response, NextFunction } from 'express';
import { ThreatIntelligence } from '../services/threatIntelligence.js';

// =========================================================================
// RULES MATRIX: Signatures for Multi-Vector Attack Detection
// =========================================================================

// Scanner User-Agents
const SCANNER_UA_REGEX = /\b(sqlmap|nikto|havij|acunetix|nessus|masscan|zgrab|gobuster|dirbuster|wpscan|nmap|arachni|whatweb|openvas|hydra|burpcollaborator)\b/i;

// Honeypot / Reconnaissance Probing Paths
const HONEYPOT_PATHS_REGEX = /(\.env|\.git|\.svn|wp-login|wp-admin|xmlrpc\.php|phpmyadmin|pma|phpinfo|actuator|\.aws|\.ssh|id_rsa|web\.config|server-status|etc\/passwd)/i;

// SQL Injection Patterns
const SQLI_PATTERNS = [
  /\bunion\b\s+(?:all\s+)?\bselect\b/i,
  /('\s*or\s*'?\d+'?\s*=\s*'?\d+)/i,
  /('\s*or\s*'[^']+'\s*=\s*'[^']+)/i,
  /;\s*(?:drop|alter|truncate|delete)\s+table\b/i,
  /\bwaitfor\s+delay\s+'/i,
  /\b(?:pg_sleep|sleep|benchmark)\s*\(/i,
  /\binformation_schema\b/i,
  /exec(?:ute)?\s+(?:xp_|sp_)/i,
  /--\s*$/m,
];

// Cross-Site Scripting (XSS) Patterns
const XSS_PATTERNS = [
  /<\s*script\b[^>]*>/i,
  /<\s*(?:iframe|embed|object|base|svg\/onload)\b[^>]*>/i,
  /\bon(?:error|load|click|mouseover|focus|blur|change|submit)\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /document\.(?:cookie|location|domain)/i,
  /window\.(?:location|localStorage|sessionStorage)/i,
];

// Path Traversal & LFI Patterns
const PATH_TRAVERSAL_PATTERNS = [
  /(?:\.\.[\\/]|%2e%2e[%2f\\]|%252e%252e)/i,
  /(?:etc[\\/](?:passwd|shadow|hosts))/i,
  /(?:windows[\\/]system32)/i,
  /(?:boot\.ini|win\.ini)/i,
];

// Command Injection & RCE Patterns
const RCE_PATTERNS = [
  /(?:[;&|`]\s*(?:cat|ls|id|whoami|uname|rm|curl|wget|nc|bash|sh|python|perl)\b)/i,
  /(?:\$\((?:cat|whoami|id|ls|curl|wget|nc)\b)/i,
  /(?:powershell(?:\.exe)?|cmd\.exe)\s+[\/\-]/i,
  /\/bin\/(?:sh|bash)\b/i,
];

// Prototype Pollution Patterns
const PROTOTYPE_POLLUTION_REGEX = /(__proto__|constructor(?:\.prototype)?)/i;

// Header CRLF Injection Patterns
const CRLF_INJECTION_REGEX = /[\r\n]+(?:content-length|transfer-encoding|set-cookie):/i;

/**
 * Helper to recursively extract all string values and keys from an object
 */
function extractStrings(target: any, depth = 0): string[] {
  if (depth > 6 || !target) return [];
  const results: string[] = [];

  if (typeof target === 'string') {
    results.push(target);
  } else if (Array.isArray(target)) {
    for (const item of target) {
      results.push(...extractStrings(item, depth + 1));
    }
  } else if (typeof target === 'object') {
    const keys = Object.getOwnPropertyNames(target);
    for (const key of keys) {
      results.push(key);
      try {
        results.push(...extractStrings(target[key], depth + 1));
      } catch {}
    }
  }

  return results;
}

function hasPrototypePollution(target: any, depth = 0): boolean {
  if (depth > 6 || !target || typeof target !== 'object') return false;
  if (Array.isArray(target)) {
    return target.some((i) => hasPrototypePollution(i, depth + 1));
  }
  for (const key of Object.getOwnPropertyNames(target)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    try {
      if (hasPrototypePollution(target[key], depth + 1)) {
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Enterprise Web Application Firewall (WAF) Shield Middleware
 */
export function wafShield(req: Request, res: Response, next: NextFunction): void {
  const clientIp = (req.ip || req.headers['x-forwarded-for'] || '127.0.0.1').toString().split(',')[0]!.trim();
  const userAgent = req.headers['user-agent'] || '';

  // 1. IP JAIL CHECK: If IP is currently banned, reject immediately
  const jailStatus = ThreatIntelligence.isIpJailed(clientIp);
  if (jailStatus.jailed) {
    res.status(403).json({
      error: 'Forbidden',
      code: 'ACCESS_RESTRICTED',
      message: 'Access from your IP address has been temporarily restricted due to detected hostile traffic.',
      retryAfterMinutes: Math.ceil(jailStatus.remainingMs / 60000),
    });
    return;
  }

  // 2. SCANNER / BOT DETECTION
  if (SCANNER_UA_REGEX.test(userAgent)) {
    ThreatIntelligence.recordViolation({
      ip: clientIp,
      category: 'SCANNER_BOT',
      score: 50,
      endpoint: req.originalUrl,
      detail: `Scanner User-Agent: ${userAgent}`,
      userAgent,
    });
    res.status(403).json({
      error: 'Forbidden',
      code: 'AUTOMATED_SCANNER_BLOCKED',
      message: 'Automated vulnerability reconnaissance scanner detected and blocked.',
    });
    return;
  }

  // 3. HONEYPOT / SENSITIVE PATH PROBE DETECTION
  if (HONEYPOT_PATHS_REGEX.test(req.originalUrl)) {
    const { nowJailed } = ThreatIntelligence.recordViolation({
      ip: clientIp,
      category: 'HONEYPOT_PROBE',
      score: 60,
      endpoint: req.originalUrl,
      detail: `Probing honeypot path: ${req.originalUrl}`,
      userAgent,
    });

    res.status(nowJailed ? 403 : 404).json({
      error: nowJailed ? 'Forbidden' : 'Not Found',
      code: 'INVALID_RESOURCE',
      message: 'The requested resource cannot be found or accessed.',
    });
    return;
  }

  // 4. PROTOTYPE POLLUTION DEEP CHECK
  if (hasPrototypePollution(req.body) || hasPrototypePollution(req.query)) {
    ThreatIntelligence.recordViolation({
      ip: clientIp,
      category: 'PROTOTYPE_POLLUTION',
      score: 40,
      endpoint: req.originalUrl,
      detail: 'Prototype pollution object key injection attempt',
      userAgent,
    });
    res.status(400).json({
      error: 'Bad Request',
      code: 'PAYLOAD_MALFORMED',
      message: 'Security policy violation: Prohibited object prototype manipulation attempt.',
    });
    return;
  }

  // Extract all query strings, URL parameters, and request body elements
  const allPayloadStrings = [
    req.originalUrl,
    ...extractStrings(req.query),
    ...extractStrings(req.params),
    ...(req.body ? extractStrings(req.body) : []),
  ];

  // 5. MULTI-VECTOR ATTACK RULES INSPECTION
  for (const snippet of allPayloadStrings) {
    if (!snippet || snippet.length === 0) continue;

    // Check Prototype Pollution
    if (PROTOTYPE_POLLUTION_REGEX.test(snippet)) {
      ThreatIntelligence.recordViolation({
        ip: clientIp,
        category: 'PROTOTYPE_POLLUTION',
        score: 40,
        endpoint: req.originalUrl,
        detail: `Prototype pollution key: ${snippet.slice(0, 50)}`,
        userAgent,
      });
      res.status(400).json({
        error: 'Bad Request',
        code: 'PAYLOAD_MALFORMED',
        message: 'Security policy violation: Prohibited object prototype manipulation attempt.',
      });
      return;
    }

    // Check Path Traversal & LFI
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(snippet)) {
        ThreatIntelligence.recordViolation({
          ip: clientIp,
          category: 'PATH_TRAVERSAL',
          score: 50,
          endpoint: req.originalUrl,
          detail: `Path traversal pattern: ${snippet.slice(0, 50)}`,
          userAgent,
        });
        res.status(400).json({
          error: 'Bad Request',
          code: 'TRAVERSAL_ATTEMPT_BLOCKED',
          message: 'Security policy violation: Path traversal sequence detected.',
        });
        return;
      }
    }

    // Check Command Injection & RCE
    for (const pattern of RCE_PATTERNS) {
      if (pattern.test(snippet)) {
        ThreatIntelligence.recordViolation({
          ip: clientIp,
          category: 'RCE',
          score: 60,
          endpoint: req.originalUrl,
          detail: `RCE / Command injection sequence: ${snippet.slice(0, 50)}`,
          userAgent,
        });
        res.status(400).json({
          error: 'Bad Request',
          code: 'COMMAND_INJECTION_BLOCKED',
          message: 'Security policy violation: Operating system command injection sequence detected.',
        });
        return;
      }
    }

    // Check SQL Injection
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(snippet)) {
        ThreatIntelligence.recordViolation({
          ip: clientIp,
          category: 'SQLI',
          score: 60,
          endpoint: req.originalUrl,
          detail: `SQL injection pattern: ${snippet.slice(0, 50)}`,
          userAgent,
        });
        res.status(400).json({
          error: 'Bad Request',
          code: 'SQL_INJECTION_BLOCKED',
          message: 'Security policy violation: Database injection sequence detected.',
        });
        return;
      }
    }

    // Check Cross-Site Scripting (XSS)
    // Note: AI prompt inputs may contain legitimate markup; we only block active executable tags & event hooks
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(snippet)) {
        ThreatIntelligence.recordViolation({
          ip: clientIp,
          category: 'XSS',
          score: 40,
          endpoint: req.originalUrl,
          detail: `XSS pattern: ${snippet.slice(0, 50)}`,
          userAgent,
        });
        res.status(400).json({
          error: 'Bad Request',
          code: 'XSS_INJECTION_BLOCKED',
          message: 'Security policy violation: Executable script injection sequence detected.',
        });
        return;
      }
    }

    // Check CRLF Header Injection
    if (CRLF_INJECTION_REGEX.test(snippet)) {
      ThreatIntelligence.recordViolation({
        ip: clientIp,
        category: 'HEADER_INJECTION',
        score: 50,
        endpoint: req.originalUrl,
        detail: `CRLF injection: ${snippet.slice(0, 50)}`,
        userAgent,
      });
      res.status(400).json({
        error: 'Bad Request',
        code: 'CRLF_INJECTION_BLOCKED',
        message: 'Security policy violation: Protocol response splitting attempt detected.',
      });
      return;
    }
  }

  // Request passed all WAF rules cleanly
  next();
}
