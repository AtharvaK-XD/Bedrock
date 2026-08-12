import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;

async function listGeminiModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
  const data = await res.json();
  console.log(data.models.map(m => m.name).join('\\n'));
}

listGeminiModels();
