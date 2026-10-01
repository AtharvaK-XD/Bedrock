import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// Custom k6 metrics for rate limiting verification
const rateLimitHits = new Counter('rate_limit_429_hits');
const successfulRequests = new Counter('successful_200_requests');
const rateLimitHeaderPreserved = new Rate('ratelimit_headers_present');

export const options = {
  scenarios: {
    // Phase 1: High-concurrency burst to trigger and verify rate limiting
    burst_rate_limit: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 5,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // We expect rate limiting to kick in during burst traffic
    'rate_limit_429_hits': ['count>0'],
    'ratelimit_headers_present': ['rate>0.90'], // 90%+ responses have rate limit headers
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173',
  };

  // Test rate limiting on AI question generation endpoint
  const payload = JSON.stringify({
    ideaText: 'Distributed microservices architecture with high concurrency caching and rate limits',
    targetType: 'coding_agent',
  });

  const res = http.post(`${BASE_URL}/api/ai/generate-questions`, payload, { headers });

  const hasLimitHeader = Boolean(res.headers['X-Ratelimit-Limit'] || res.headers['X-RateLimit-Limit']);
  const hasRemainingHeader = Boolean(res.headers['X-Ratelimit-Remaining'] || res.headers['X-RateLimit-Remaining']);

  rateLimitHeaderPreserved.add(hasLimitHeader && hasRemainingHeader);

  if (res.status === 200) {
    successfulRequests.add(1);
    check(res, {
      'Status is 200 OK within quota': (r) => r.status === 200,
      'Contains RateLimit headers': () => hasLimitHeader && hasRemainingHeader,
    });
  } else if (res.status === 429) {
    rateLimitHits.add(1);
    check(res, {
      'Rate limit exceeded returns 429': (r) => r.status === 429,
      'Retry-After header present': (r) => Boolean(r.headers['Retry-After'] || r.headers['retry-after']),
      'Error response code is RATE_LIMIT_EXCEEDED': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.code === 'RATE_LIMIT_EXCEEDED' || body.error === 'Rate Limit Exceeded' || body.error === 'Too Many Requests';
        } catch {
          return false;
        }
      },
    });
  } else {
    check(res, {
      'Response is either 200 or 429': (r) => r.status === 200 || r.status === 429,
    });
  }

  // Small sleep to control burst rhythm
  sleep(0.3);
}
