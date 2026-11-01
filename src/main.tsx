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

// Restore saved appearance and initialize secure key store before render
applyAppearanceToDom()
initSecureKeyStore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PostHogProvider
        apiKey={import.meta.env.VITE_POSTHOG_KEY || 'phc_placeholder'}
        options={posthogOptions}
      >
        <App />
      </PostHogProvider>
    </StrictMode>,
  )
})
