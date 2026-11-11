import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.tsx'
import { initSecureKeyStore } from './lib/secureKeyStore'
import { applyAppearanceToDom } from './lib/appSettings'
import { applyAnalyticsConsent, isAnalyticsEnabled } from './lib/analyticsConsent'
import { syncAnthropicModelsIfAvailable } from './lib/anthropicModels'
import { syncAllConfiguredModels } from './lib/dynamicModelDiscovery'
import { scrubDeep } from './lib/scrubUrl'
import type { CaptureResult } from 'posthog-js'


// Crash reports and analytics start only if allowed in Settings > Privacy & Security
applyAnalyticsConsent()

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-05-30' as const,
  opt_out_capturing_by_default: !isAnalyticsEnabled(),
  // Clicks are recorded without the clicked element's text or attributes (they can hold prompt text or links),
  // and every event is scrubbed of keys, tokens and secret URL parameters before it leaves the browser
  mask_all_text: true,
  mask_all_element_attributes: true,
  before_send: (event: CaptureResult | null) => scrubDeep(event),
}

// Restore saved appearance and initialize secure key store before render
applyAppearanceToDom()
syncAnthropicModelsIfAvailable()
syncAllConfiguredModels()
initSecureKeyStore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PostHogProvider
        apiKey={import.meta.env.VITE_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || 'phc_placeholder'}
        options={posthogOptions}
      >
        <App />
      </PostHogProvider>
    </StrictMode>,
  )
})
