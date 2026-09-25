import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test: Core Wizard Flow Under Launch Spike
export const options = {
  stages: [
    { duration: '20s', target: 5 },   // Ramp-up to 5 users
    { duration: '40s', target: 20 },  // Peak launch spike: 20 concurrent users
    { duration: '20s', target: 5 },   // Scale down
    { duration: '10s', target: 0 },   // Recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Failure rate must be under 5%
    http_req_duration: ['p(95)<10000'], // 95% of requests under 10s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173',
  };

  // Step 1: Health & Status Check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'Health check returns 200': (r) => r.status === 200,
    'Database is connected': (r) => r.json().services.database === 'connected',
  });

  sleep(1);

  // Step 2: Generate Questions (Wizard Step 1)
  const questionPayload = JSON.stringify({
    ideaText: 'A decentralized marketplace for AI prompts with biometric escrow security',
    targetType: 'coding_agent',
  });

  const questionsRes = http.post(`${BASE_URL}/api/ai/generate-questions`, questionPayload, { headers });
  check(questionsRes, {
    'Generate questions returns 200': (r) => r.status === 200,
    'Returns array of questions': (r) => Array.isArray(r.json()) && r.json().length >= 3,
  });

  let questions = [];
  try {
    questions = questionsRes.json();
  } catch (e) {
    questions = [];
  }

  sleep(2);

  // Step 3: Synthesize Prompt (Wizard Step 2)
  if (questions.length > 0) {
    const answers = [
      { questionId: questions[0]?.id || 'q1', value: 'Ethereum and Polygon Layer 2' },
      { questionId: questions[1]?.id || 'q2', value: 'Zero-knowledge biometric proofs' },
    ];

    const synthesizePayload = JSON.stringify({
      idea: {
        ideaText: 'A decentralized marketplace for AI prompts with biometric escrow security',
        targetType: 'coding_agent',
      },
      answers,
      questions,
    });

    const synthRes = http.post(`${BASE_URL}/api/ai/synthesize`, synthesizePayload, { headers });
    check(synthRes, {
      'Synthesize returns 200': (r) => r.status === 200,
      'Content is non-empty': (r) => r.json().content && r.json().content.length > 100,
    });

    sleep(2);

    // Step 4: Refine Prompt
    const refinePayload = JSON.stringify({
      currentPrompt: synthRes.json()?.content?.slice(0, 1000) || 'Base prompt',
      followUp: 'Add strict multi-sig escrow requirements and rate limiting.',
    });

    const refineRes = http.post(`${BASE_URL}/api/ai/refine`, refinePayload, { headers });
    check(refineRes, {
      'Refine returns 200': (r) => r.status === 200,
      'Returns updated markdown': (r) => Boolean(r.json().updatedMarkdown),
    });
  }

  sleep(3);
}
