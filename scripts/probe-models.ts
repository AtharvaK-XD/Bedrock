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

interface ModelResult {
  provider: string;
  model: string;
  status: 'SUCCESS' | 'FAILED' | 'MISSING_KEY';
  latencyMs: number;
  output?: string;
  error?: string;
  keyRequired?: string;
}

const results: ModelResult[] = [];

async function probeGroq(model: string) {
  const key = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY;
  if (!key) {
    results.push({ provider: 'Groq', model, status: 'MISSING_KEY', latencyMs: 0, keyRequired: 'VITE_GROQ_API_KEY' });
    console.log(`[Groq] ${model}: ⚠️ MISSING KEY`);
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
      const output = data.choices[0].message.content.trim();
      results.push({ provider: 'Groq', model, status: 'SUCCESS', latencyMs, output });
      console.log(`[Groq] ${model}: ✅ SUCCESS (${latencyMs}ms) -> "${output}"`);
    } else {
      const error = data.error?.message || JSON.stringify(data);
      results.push({ provider: 'Groq', model, status: 'FAILED', latencyMs, error });
      console.log(`[Groq] ${model}: ❌ FAILED (${latencyMs}ms) -> ${error.slice(0, 80)}`);
    }
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    results.push({ provider: 'Groq', model, status: 'FAILED', latencyMs, error: err.message });
    console.log(`[Groq] ${model}: ❌ FAILED (${latencyMs}ms) -> ${err.message}`);
  }
}

async function probeGemini(model: string) {
  const key = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!key) {
    results.push({ provider: 'Google Gemini', model, status: 'MISSING_KEY', latencyMs: 0, keyRequired: 'VITE_GEMINI_API_KEY' });
    console.log(`[Gemini] ${model}: ⚠️ MISSING KEY`);
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
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const output = data.candidates[0].content.parts[0].text.trim();
      results.push({ provider: 'Google Gemini', model, status: 'SUCCESS', latencyMs, output });
      console.log(`[Gemini] ${model}: ✅ SUCCESS (${latencyMs}ms) -> "${output}"`);
    } else {
      const error = data.error?.message || JSON.stringify(data);
      results.push({ provider: 'Google Gemini', model, status: 'FAILED', latencyMs, error });
      console.log(`[Gemini] ${model}: ❌ FAILED (${latencyMs}ms) -> ${error.slice(0, 80)}`);
    }
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    results.push({ provider: 'Google Gemini', model, status: 'FAILED', latencyMs, error: err.message });
    console.log(`[Gemini] ${model}: ❌ FAILED (${latencyMs}ms) -> ${err.message}`);
  }
}

async function probeOpenRouter(model: string) {
  const key = env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
  if (!key) {
    results.push({ provider: 'OpenRouter', model, status: 'MISSING_KEY', latencyMs: 0, keyRequired: 'VITE_OPENROUTER_API_KEY' });
    console.log(`[OpenRouter] ${model}: ⚠️ MISSING KEY`);
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
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    if (res.ok && data.choices?.[0]?.message?.content) {
      const output = data.choices[0].message.content.trim();
      results.push({ provider: 'OpenRouter', model, status: 'SUCCESS', latencyMs, output });
      console.log(`[OpenRouter] ${model}: ✅ SUCCESS (${latencyMs}ms) -> "${output}"`);
    } else {
      const error = data.error?.message || JSON.stringify(data);
      results.push({ provider: 'OpenRouter', model, status: 'FAILED', latencyMs, error });
      console.log(`[OpenRouter] ${model}: ❌ FAILED (${latencyMs}ms) -> ${error.slice(0, 80)}`);
    }
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    results.push({ provider: 'OpenRouter', model, status: 'FAILED', latencyMs, error: err.message });
    console.log(`[OpenRouter] ${model}: ❌ FAILED (${latencyMs}ms) -> ${err.message}`);
  }
}

async function probeHuggingFace(model: string) {
  const key = env.VITE_HUGGINGFACE_API_KEY || env.HUGGINGFACE_API_KEY;
  if (!key) {
    results.push({ provider: 'Hugging Face', model, status: 'MISSING_KEY', latencyMs: 0, keyRequired: 'VITE_HUGGINGFACE_API_KEY' });
    console.log(`[Hugging Face] ${model}: ⚠️ MISSING KEY`);
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
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - t0;
    const data: any = await res.json();
    if (res.ok) {
      const output = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || JSON.stringify(data);
      results.push({ provider: 'Hugging Face', model, status: 'SUCCESS', latencyMs, output: String(output).trim() });
      console.log(`[Hugging Face] ${model}: ✅ SUCCESS (${latencyMs}ms) -> "${String(output).trim()}"`);
    } else {
      const error = data.error || JSON.stringify(data);
      results.push({ provider: 'Hugging Face', model, status: 'FAILED', latencyMs, error });
      console.log(`[Hugging Face] ${model}: ❌ FAILED (${latencyMs}ms) -> ${error.slice(0, 80)}`);
    }
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    results.push({ provider: 'Hugging Face', model, status: 'FAILED', latencyMs, error: err.message });
    console.log(`[Hugging Face] ${model}: ❌ FAILED (${latencyMs}ms) -> ${err.message}`);
  }
}

async function probeOllama() {
  const t0 = Date.now();
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    const latencyMs = Date.now() - t0;
    if (res.ok) {
      const data: any = await res.json();
      const models = data.models?.map((m: any) => m.name).join(', ') || 'No local models pulled';
      results.push({ provider: 'Ollama (Local)', model: 'localhost:11434', status: 'SUCCESS', latencyMs, output: `Online (${models})` });
      console.log(`[Ollama] Local daemon: ✅ ONLINE (${latencyMs}ms) -> Models: ${models}`);
    } else {
      results.push({ provider: 'Ollama (Local)', model: 'localhost:11434', status: 'FAILED', latencyMs, error: `HTTP ${res.status}` });
      console.log(`[Ollama] Local daemon: ❌ HTTP ${res.status}`);
    }
  } catch (err: any) {
    results.push({ provider: 'Ollama (Local)', model: 'localhost:11434', status: 'FAILED', latencyMs: Date.now() - t0, error: 'Ollama daemon not running' });
    console.log(`[Ollama] Local daemon: ⚠️ NOT RUNNING on localhost:11434`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('       STARTING BEDROCK LIVE MODEL VERIFICATION       ');
  console.log('======================================================\n');

  console.log('--- 1. GROQ INFERENCE CLOUD ---');
  await probeGroq('llama-3.3-70b-versatile');
  await probeGroq('llama-3.1-8b-instant');
  await probeGroq('deepseek-r1-distill-llama-70b');
  await probeGroq('mixtral-8x7b-32768');

  console.log('\n--- 2. GOOGLE GEMINI MODELS ---');
  await probeGemini('gemini-2.5-flash');
  await probeGemini('gemini-flash-latest');
  await probeGemini('gemini-1.5-flash');
  await probeGemini('gemini-1.5-pro');

  console.log('\n--- 3. OPENROUTER MULTI-PROVIDER GATEWAY ---');
  await probeOpenRouter('openai/gpt-4o-mini');
  await probeOpenRouter('meta-llama/llama-3.1-8b-instruct');
  await probeOpenRouter('deepseek/deepseek-r1');
  await probeOpenRouter('anthropic/claude-3.5-sonnet');
  await probeOpenRouter('mistralai/mistral-large');
  await probeOpenRouter('perplexity/sonar');

  console.log('\n--- 4. HUGGING FACE INFERENCE ---');
  await probeHuggingFace('hf/mistralai/Mistral-7B-Instruct-v0.3');
  await probeHuggingFace('hf/Qwen/Qwen2.5-72B-Instruct');

  console.log('\n--- 5. LOCAL OLLAMA AIR-GAPPED RUNTIME ---');
  await probeOllama();

  console.log('\n======================================================');
  console.log('                     PROBE COMPLETE                   ');
  console.log('======================================================\n');
}

main();
