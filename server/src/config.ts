import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProduction,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'bedrock_vault_sec_jwt_key_99478f248bb82d274',
  jwtExpiresIn: '7d',
  cookieName: 'token',
  
  corsOrigins: [
    'http://localhost:5173',
    'http://localhost:1420',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:1420',
    'tauri://localhost',
    'electron://localhost',
  ],

  ai: {
    geminiKey: (process.env.GEMINI_API_KEY || '').trim(),
    groqKey: (process.env.GROQ_API_KEY || '').trim(),
    openRouterKey: (process.env.OPENROUTER_API_KEY || '').trim(),
    huggingFaceKey: (process.env.HUGGINGFACE_API_KEY || '').trim(),
    openAiKey: (process.env.OPENAI_API_KEY || '').trim(),
    anthropicKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
    ollamaEndpoint: (process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434').trim(),
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxGeneral: 300,
    maxAuth: 20,
    maxAi: 60,
  },

  limits: {
    jsonPayloadLimit: '2mb',
    urlEncodedLimit: '2mb',
  }
};
