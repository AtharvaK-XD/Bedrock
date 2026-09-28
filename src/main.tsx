import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: 'https://bc8788b769ee7e46499af64ac7672f33@o4512165526437888.ingest.us.sentry.io/4512165536923648',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app/,
    /^https:\/\/bedrockxai\.com/,
  ],
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-05-30',
} as const

const posthogApiKey =
  import.meta.env.VITE_POSTHOG_PROJECT_TOKEN ||
  'phc_uL4jhA9XRcgtFUzhifkjZuGHjmYcQ3BGev3bWNvrj4BD'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider apiKey={posthogApiKey} options={posthogOptions}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)
