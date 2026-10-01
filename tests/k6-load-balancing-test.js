import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const redisConnectedRate = new Rate('redis_connected_rate');
const requestDurationTrend = new Trend('custom_request_duration');

export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Ramp-up to 5 concurrent VUs
    { duration: '20s', target: 15 },  // Peak traffic: 15 concurrent VUs
    { duration: '10s', target: 5 },   // Scale down
    { duration: '5s', target: 0 },    // Cooldown
  ],
  thresholds: {
    // 95% of non-rate-limited requests should complete within 4s
    'http_req_duration': ['p(95)<4000'],
    // Redis health rate should be healthy
    'redis_connected_rate': ['rate>0.90'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173',
  };

  // 1. Health & Distributed Load Balancer Telemetry Check
  const healthRes = http.get(`${BASE_URL}/api/health`, { headers });
  
  if (healthRes.status === 200) {
    try {
      const data = JSON.parse(healthRes.body);
      const isRedisHealthy = Boolean(
        data.redis?.status === 'connected' ||
        data.services?.redis === 'upstash_configured' ||
        data.rateLimiting?.active === true
      );
      redisConnectedRate.add(isRedisHealthy);

      check(healthRes, {
        'Health endpoint returns 200': (r) => r.status === 200,
        'Redis / RateLimiter is active': () => isRedisHealthy,
      });
    } catch {
      redisConnectedRate.add(false);
    }
  }

  sleep(1);

  // 2. Load-Balanced AI Generation Check
  const genPayload = JSON.stringify({
    ideaText: 'High-throughput payment gateway with distributed consensus and cryptographic audit log',
    targetType: 'coding_agent',
  });

  const startTime = Date.now();
  const genRes = http.post(`${BASE_URL}/api/ai/generate-questions`, genPayload, { headers });
  requestDurationTrend.add(Date.now() - startTime);

  check(genRes, {
    'AI Generation returns valid status (200 or 429)': (r) => r.status === 200 || r.status === 429,
    'Rate limit headers present': (r) => Boolean(
      r.headers['X-RateLimit-Limit'] || r.headers['X-Ratelimit-Limit']
    ),
  });

  sleep(2);
}
