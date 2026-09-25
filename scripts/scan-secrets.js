#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const PATTERNS = [
  { name: 'Groq API Key', regex: /gsk_[A-Za-z0-9_-]{30,}/g },
  { name: 'OpenRouter API Key', regex: /sk-or-v1-[a-f0-9]{40,}/g },
  { name: 'HuggingFace Token', regex: /hf_[A-Za-z0-9]{25,}/g },
  { name: 'OpenAI Secret Key', regex: /sk-(?:live|test|proj)-[A-Za-z0-9_-]{20,}/g },
  { name: 'Anthropic Key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'Razorpay Live Key', regex: /rzp_live_[A-Za-z0-9]{10,}/g },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  '.env',
  '.env.local',
  'dev.db',
  'package-lock.json',
  '.env.example',
];

let totalFilesScanned = 0;
const violations = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath);

    if (IGNORED_PATHS.some((ignored) => relPath.startsWith(ignored) || relPath.includes(ignored))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      // Only scan code, text, json, yaml, md files
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.md', '.html'].includes(ext)) {
        continue;
      }

      totalFilesScanned++;
      const content = fs.readFileSync(fullPath, 'utf8');

      for (const pattern of PATTERNS) {
        const matches = content.match(pattern.regex);
        if (matches) {
          violations.push({
            file: relPath,
            rule: pattern.name,
            match: matches[0].slice(0, 8) + '...' + matches[0].slice(-4),
          });
        }
      }
    }
  }
}

console.log('🔍 Running Bedrock Automated Secret Scanner...');
scanDir(process.cwd());

console.log(`Scanned ${totalFilesScanned} files across repository.`);

if (violations.length > 0) {
  console.error('\n🚨 CRITICAL SECURITY ALERT: Unencrypted credentials detected in repository files:');
  for (const v of violations) {
    console.error(`  - [${v.rule}] in ${v.file} (Key: ${v.match})`);
  }
  console.error('\nCommit BLOCKED. Move credentials to .env or encrypted CI environment variables.\n');
  process.exit(1);
} else {
  console.log('✅ No credentials or secret leaks detected in codebase.\n');
  process.exit(0);
}
