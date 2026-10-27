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

  // Overrides to force empty string for any forbidden secret in the client bundle
  const defineOverrides: Record<string, string> = {};
  for (const key of FORBIDDEN_SECRETS) {
    defineOverrides[`import.meta.env.${key}`] = JSON.stringify('');
    // Delete from process.env during Vite build execution so it cannot be inlined by envPrefix
    delete process.env[key];
  }

  for (const forbidden of FORBIDDEN_SECRETS) {
    if (env[forbidden] && env[forbidden].trim().length > 0) {
      console.warn(
        `⚠️ [VITE_ LEAK GUARD] Stripped "${forbidden}" from client bundle to prevent public exposure in browser DevTools. (Use "${forbidden.replace('VITE_', '')}" in serverless backend).`
      );
    }
  }

  return {
    base: '/',
    define: defineOverrides,
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

