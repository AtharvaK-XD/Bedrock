import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.tsx'
import { initSecureKeyStore } from './lib/secureKeyStore'
import { applyAppearanceToDom } from './lib/appSettings'
import { applyAnalyticsConsent, isAnalyticsEnabled } from './lib/analyticsConsent'

// Crash reports and analytics start only if allowed in Settings > Privacy & Security
applyAnalyticsConsent()

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-05-30',
  opt_out_capturing_by_default: !isAnalyticsEnabled(),
} as const

const posthogApiKey =
  import.meta.env.VITE_POSTHOG_PROJECT_TOKEN ||
  'phc_uL4jhA9XRcgtFUzhifkjZuGHjmYcQ3BGev3bWNvrj4BD'

// Desktop: load OS-encrypted API keys before the app reads them (no-op on the website)
initSecureKeyStore().finally(() => {
  // Apply theme, accent and font before the first paint so there is no flash of the default look
  applyAppearanceToDom()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PostHogProvider apiKey={posthogApiKey} options={posthogOptions}>
        <App />
      </PostHogProvider>
    </StrictMode>,
  )
})
