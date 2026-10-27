import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const FORBIDDEN_SECRETS = [
    'VITE_GROQ_API_KEY',
    'VITE_GEMINI_API_KEY',
    'VITE_OPENROUTER_API_KEY',
    'VITE_HUGGINGFACE_API_KEY',
    'VITE_OPENAI_API_KEY',
    'VITE_ANTHROPIC_API_KEY',
    'VITE_DATABASE_URL',
    'VITE_NEON_DATABASE_URL',
    'VITE_RAZORPAY_KEY_SECRET',
    'VITE_UPSTASH_REDIS_REST_TOKEN',
    'VITE_CLERK_SECRET_KEY',
    'VITE_RESEND_API_KEY',
  ];

  for (const forbidden of FORBIDDEN_SECRETS) {
    if (env[forbidden] && env[forbidden].trim().length > 0) {
      throw new Error(
        `🚨 [SECURITY RISK DETECTED] "${forbidden}" is defined in your environment with a "VITE_" prefix.\n` +
        `Vite automatically inlines all VITE_* variables directly into public client-side JavaScript.\n` +
        `To fix: Remove the "VITE_" prefix so it is strictly accessible on the serverless backend (e.g. "${forbidden.replace('VITE_', '')}").`
      );
    }
  }

  return {
    base: '/',
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    }
  };
})

