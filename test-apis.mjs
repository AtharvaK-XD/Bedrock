import dotenv from 'dotenv';
import fs from 'fs';

// Load .env.local manually
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const GROQ_KEY = process.env.VITE_GROQ_API_KEY;
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;
const OPENROUTER_KEY = process.env.VITE_OPENROUTER_API_KEY;
const HF_KEY = process.env.VITE_HUGGINGFACE_API_KEY;

async function testGroq() {
  console.log('Testing Groq...');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{role: 'user', content: 'Hi'}] })
  });
  if (!res.ok) throw new Error(`Groq Error: ${await res.text()}`);
  console.log('✅ Groq works!');
}

async function testGemini() {
  console.log('Testing Gemini...');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
  });
  if (!res.ok) throw new Error(`Gemini Error: ${await res.text()}`);
  console.log('✅ Gemini works!');
}

async function testOpenRouter() {
  console.log('Testing OpenRouter...');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemma-2-9b-it:free', messages: [{role: 'user', content: 'Hi'}] })
  });
  if (!res.ok) throw new Error(`OpenRouter Error: ${await res.text()}`);
  console.log('✅ OpenRouter works!');
}

async function testHF() {
  console.log('Testing Hugging Face...');
  const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'mistralai/Mistral-7B-Instruct-v0.3', messages: [{role: 'user', content: 'Hi'}], max_tokens: 10 })
  });
  if (!res.ok) throw new Error(`HF Error: ${await res.text()}`);
  console.log('✅ Hugging Face works!');
}

async function runAll() {
  try {
    await testGroq();
    await testGemini();
    await testOpenRouter();
    await testHF();
    console.log('\\n🎉 ALL APIS ARE WORKING PERFECTLY!');
  } catch (err) {
    console.error('\\n❌ TEST FAILED:', err.message);
  }
}

runAll();
