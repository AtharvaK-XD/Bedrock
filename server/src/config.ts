import dotenv from 'dotenv';

// Load .env
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function parseKeys(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY);
const openRouterKeys = parseKeys(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);
const huggingFaceKeys = parseKeys(process.env.HUGGINGFACE_API_KEYS || process.env.HUGGINGFACE_API_KEY);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProduction,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'bedrock_vault_sec_jwt_key_99478f248bb82d274',
  jwtExpiresIn: '7d',
  cookieName: 'token',

  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [
        'http://localhost:5173',
        'http://localhost:1420',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:1420',
        'tauri://localhost',
        'electron://localhost',
        'https://bedrock.app',
        'https://staging.bedrock.app',
      ]
  ),

  ai: {
    groqKeys,
    openRouterKeys,
    geminiKeys,
    huggingFaceKeys,
    openAiKey: (process.env.OPENAI_API_KEY || '').trim(),
    anthropicKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
    paidOverflowKey: (process.env.PAID_OVERFLOW_KEY || openRouterKeys[0] || '').trim(),
    paidOverflowModel: process.env.PAID_OVERFLOW_MODEL || 'openai/gpt-4o',
    ollamaEndpoint: (process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434').trim(),
  },

  razorpay: {
    keyId: (process.env.RAZORPAY_KEY_ID || 'rzp_test_bedrock_key').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_bedrock_test').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || 'bedrock_whsec_live_2026').trim(),
  },

  monitoring: {
    sentryDsn: (process.env.SENTRY_DSN || '').trim(),
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxGeneral: 300,
    maxAuth: 15,
  },

  limits: {
    jsonPayloadLimit: '2mb',
    urlEncodedLimit: '2mb',
    maxIdeaTextLength: 5000,
    maxRefineLength: 5000,
    maxPromptLength: 30000,
  },
};
