import fs from 'node:fs';

function loadEnv() {
  const env: Record<string, string> = {};
  const paths = ['.env.local', '.env', 'server/.env'];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();

interface TestRecord {
  provider: string;
  model: string;
  isFreeTier: boolean;
  status: 'ONLINE' | 'FAILED' | 'NO_API_KEY';
  latencyMs: number;
  outputSnippet?: string;
  errorReason?: string;
  fixAction?: string;
}

const records: TestRecord[] = [];

async function testGroq(model: string, isFree: boolean) {
  const key = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY;
  if (!key) {
    records.push({
      provider: 'Groq Cloud',
      model,
      isFreeTier: isFree,
      status: 'NO_API_KEY',
      latencyMs: 0,
      errorReason: 'Missing GROQ API Key in .env.local',
      fixAction: 'Add VITE_GROQ_API_KEY (free at console.groq.com)',
    });
    return;
  }
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say hello in 2 words' }],
        max_tokens: 15,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    if (res.ok && data.choices?.[0]?.message?.content) {
      records.push({
        provider: 'Groq Cloud',
        model,
        isFreeTier: isFree,
        status: 'ONLINE',
        latencyMs,
        outputSnippet: data.choices[0].message.content.trim(),
      });
    } else {
      records.push({
        provider: 'Groq Cloud',
        model,
        isFreeTier: isFree,
        status: 'FAILED',
        latencyMs,
        errorReason: data.error?.message || `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 100)}`,
        fixAction: 'Use active model or check Groq deprecations',
      });
    }
  } catch (err: any) {
    records.push({
      provider: 'Groq Cloud',
      model,
      isFreeTier: isFree,
      status: 'FAILED',
      latencyMs: Date.now() - t0,
      errorReason: err.message,
    });
  }
}

async function testGemini(model: string, isFree: boolean) {
  const key = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!key) {
    records.push({
      provider: 'Google Gemini',
      model,
      isFreeTier: isFree,
      status: 'NO_API_KEY',
      latencyMs: 0,
      errorReason: 'Missing GEMINI API Key in .env.local',
      fixAction: 'Add VITE_GEMINI_API_KEY (free at aistudio.google.com)',
    });
    return;
  }
  const t0 = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hello in 2 words' }] }],
        generationConfig: { maxOutputTokens: 15, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(7000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      records.push({
        provider: 'Google Gemini',
        model,
        isFreeTier: isFree,
        status: 'ONLINE',
        latencyMs,
        outputSnippet: data.candidates[0].content.parts[0].text.trim(),
      });
    } else {
      records.push({
        provider: 'Google Gemini',
        model,
        isFreeTier: isFree,
        status: 'FAILED',
        latencyMs,
        errorReason: data.error?.message || `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 100)}`,
        fixAction: 'Model may be deprecated or rate limited in region',
      });
    }
  } catch (err: any) {
    records.push({
      provider: 'Google Gemini',
      model,
      isFreeTier: isFree,
      status: 'FAILED',
      latencyMs: Date.now() - t0,
      errorReason: err.message,
    });
  }
}

async function testOpenRouter(model: string, isFree: boolean) {
  const key = env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
  if (!key) {
    records.push({
      provider: 'OpenRouter',
      model,
      isFreeTier: isFree,
      status: 'NO_API_KEY',
      latencyMs: 0,
      errorReason: 'Missing OpenRouter API Key',
      fixAction: 'Add VITE_OPENROUTER_API_KEY (free at openrouter.ai)',
    });
    return;
  }
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://bedrock.dev',
        'X-Title': 'Bedrock Workstation',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say hello in 2 words' }],
        max_tokens: 15,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(9000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning;
    if (res.ok && content) {
      records.push({
        provider: 'OpenRouter',
        model,
        isFreeTier: isFree,
        status: 'ONLINE',
        latencyMs,
        outputSnippet: content.trim().slice(0, 50),
      });
    } else {
      const errorMsg = data.error?.message || `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 100)}`;
      records.push({
        provider: 'OpenRouter',
        model,
        isFreeTier: isFree,
        status: 'FAILED',
        latencyMs,
        errorReason: errorMsg,
        fixAction: errorMsg.includes('credits') ? 'Requires OpenRouter credits' : 'Model not active or unavailable on free tier',
      });
    }
  } catch (err: any) {
    records.push({
      provider: 'OpenRouter',
      model,
      isFreeTier: isFree,
      status: 'FAILED',
      latencyMs: Date.now() - t0,
      errorReason: err.message,
    });
  }
}

async function testHuggingFace(model: string, isFree: boolean) {
  const key = env.VITE_HUGGINGFACE_API_KEY || env.HUGGINGFACE_API_KEY;
  if (!key) {
    records.push({
      provider: 'Hugging Face',
      model,
      isFreeTier: isFree,
      status: 'NO_API_KEY',
      latencyMs: 0,
      errorReason: 'Missing HuggingFace Token',
      fixAction: 'Add VITE_HUGGINGFACE_API_KEY (free token on huggingface.co)',
    });
    return;
  }
  const t0 = Date.now();
  try {
    const cleanModel = model.replace(/^hf\//, '');
    const res = await fetch(`https://api-inference.huggingface.co/models/${cleanModel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        inputs: 'Say hello in 2 words',
        parameters: { max_new_tokens: 15, return_full_text: false },
      }),
      signal: AbortSignal.timeout(9000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    if (res.ok) {
      const output = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
      records.push({
        provider: 'Hugging Face',
        model,
        isFreeTier: isFree,
        status: 'ONLINE',
        latencyMs,
        outputSnippet: String(output || '').trim(),
      });
    } else {
      records.push({
        provider: 'Hugging Face',
        model,
        isFreeTier: isFree,
        status: 'FAILED',
        latencyMs,
        errorReason: data.error || `HTTP ${res.status}`,
        fixAction: 'Model warm-up needed or PRO gated',
      });
    }
  } catch (err: any) {
    records.push({
      provider: 'Hugging Face',
      model,
      isFreeTier: isFree,
      status: 'FAILED',
      latencyMs: Date.now() - t0,
      errorReason: err.message,
    });
  }
}

async function testOllama() {
  const t0 = Date.now();
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    const latencyMs = Date.now() - t0;
    if (res.ok) {
      const data: any = await res.json();
      const models = data.models?.map((m: any) => m.name).join(', ') || 'No local models pulled';
      records.push({
        provider: 'Ollama (Local)',
        model: 'localhost:11434',
        isFreeTier: true,
        status: 'ONLINE',
        latencyMs,
        outputSnippet: `Local daemon active (${models})`,
      });
    } else {
      records.push({
        provider: 'Ollama (Local)',
        model: 'localhost:11434',
        isFreeTier: true,
        status: 'FAILED',
        latencyMs,
        errorReason: `HTTP ${res.status}`,
      });
    }
  } catch (err: any) {
    records.push({
      provider: 'Ollama (Local)',
      model: 'localhost:11434',
      isFreeTier: true,
      status: 'FAILED',
      latencyMs: Date.now() - t0,
      errorReason: 'Ollama daemon is not running on localhost:11434',
      fixAction: 'Run `ollama serve` locally (100% free, runs offline)',
    });
  }
}

function checkDirectMissing(provider: string, model: string, keyName: string, signupUrl: string) {
  const key = env[keyName] || env[`VITE_${keyName}`];
  if (!key) {
    records.push({
      provider,
      model,
      isFreeTier: false,
      status: 'NO_API_KEY',
      latencyMs: 0,
      errorReason: `Direct ${provider} key (${keyName}) is not present in .env.local`,
      fixAction: `Get key from ${signupUrl} OR use OpenRouter/Groq free equivalent`,
    });
  }
}

async function runBenchmark() {
  console.log('Testing Groq Cloud models...');
  await testGroq('qwen/qwen3.8-27b', true);
  await testGroq('openai/gpt-oss-120b', true);
  await testGroq('openai/gpt-oss-20b', true);
  await testGroq('llama-3.3-70b-versatile', true);
  await testGroq('llama-3.1-8b-instant', true);
  await testGroq('deepseek-r1-distill-llama-70b', true);

  console.log('Testing Google Gemini models...');
  await testGemini('gemini-2.5-flash', true);
  await testGemini('gemini-flash-latest', true);
  await testGemini('gemini-1.5-flash', true);
  await testGemini('gemini-1.5-pro', true);

  console.log('Testing OpenRouter models...');
  await testOpenRouter('openrouter/free', true);
  await testOpenRouter('poolside/laguna-s-2.1:free', true);
  await testOpenRouter('nvidia/nemotron-3-ultra-550b-a55b:free', true);
  await testOpenRouter('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', true);
  await testOpenRouter('openai/gpt-4o-mini', false);
  await testOpenRouter('openai/gpt-4o', false);
  await testOpenRouter('anthropic/claude-3.5-sonnet', false);
  await testOpenRouter('deepseek/deepseek-r1', false);
  await testOpenRouter('meta-llama/llama-3.3-70b-instruct', false);
  await testOpenRouter('mistralai/mistral-large', false);

  console.log('Testing HuggingFace models...');
  await testHuggingFace('hf/mistralai/Mistral-7B-Instruct-v0.3', true);
  await testHuggingFace('hf/Qwen/Qwen2.5-72B-Instruct', true);

  console.log('Testing Ollama Local runtime...');
  await testOllama();

  console.log('Checking Direct API Keys status...');
  checkDirectMissing('OpenAI Direct', 'gpt-4o / gpt-4o-mini', 'OPENAI_API_KEY', 'platform.openai.com');
  checkDirectMissing('Anthropic Direct', 'claude-3-5-sonnet-20241022', 'ANTHROPIC_API_KEY', 'console.anthropic.com');
  checkDirectMissing('Perplexity Direct', 'sonar / sonar-pro', 'PERPLEXITY_API_KEY', 'perplexity.ai/settings/api');
  checkDirectMissing('Mistral Direct', 'mistral-large-latest', 'MISTRAL_API_KEY', 'console.mistral.ai');
  checkDirectMissing('Cohere Direct', 'command-r-plus', 'COHERE_API_KEY', 'dashboard.cohere.com');
  checkDirectMissing('xAI Direct', 'grok-2-latest', 'XAI_API_KEY', 'console.x.ai');

  fs.writeFileSync('scripts/model-results.json', JSON.stringify(records, null, 2));
  console.log('\nResults written to scripts/model-results.json');
}

runBenchmark();
