import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { KNOWN_SERVER_ONLY_VITE_VARS, isSecretLikeViteVar } from './viteEnvGuard.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // The known server-only names, plus ANY VITE_ variable whose name looks like a secret (viteEnvGuard.ts)
  const FORBIDDEN_SECRETS = [
    ...new Set([...KNOWN_SERVER_ONLY_VITE_VARS, ...Object.keys(env).filter(isSecretLikeViteVar)]),
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

