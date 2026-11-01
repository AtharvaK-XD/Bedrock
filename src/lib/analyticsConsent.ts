import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { BEDROCK_SETTINGS_UPDATED_EVENT, getActivePrivacySettings } from './appSettings';
import { tracePropagationTargets } from './sentryTargets';

/**
 * Crash reports (Sentry) and usage analytics (PostHog) only run while
 * Settings > Privacy & Security > "Crash reports & usage analytics" is on.
 */

let sentryStarted = false;

function startSentry(): void {
  if (sentryStarted) return;
  sentryStarted = true;
  Sentry.init({
    dsn: 'https://bc8788b769ee7e46499af64ac7672f33@o4512165526437888.ingest.us.sentry.io/4512165536923648',
    integrations: [
      Sentry.browserTracingIntegration(),
      // Recordings never contain on-screen text or typed values (prompts, emails, API keys)
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring (sampled: less user data leaves the browser)
    tracesSampleRate: 0.2,
    tracePropagationTargets: tracePropagationTargets(typeof window !== 'undefined' ? window.location.origin : undefined),
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      /Error creating WebGL context/i,
      /THREE\.WebGLRenderer: Error creating WebGL context/i,
      /WebGL context was lost/i,
      /ResizeObserver loop limit exceeded/i,
    ],
    beforeSend(event, hint) {
      // Switched off after start-up: drop anything that is still queued
      if (!getActivePrivacySettings().telemetry) return null;
      const error = hint?.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const msg = String((error as { message?: unknown }).message || '');
        if (
          msg.includes('Error creating WebGL context') ||
          msg.includes('WebGLRenderer') ||
          msg.includes('webglcontextlost')
        ) {
          return null;
        }
      }
      return event;
    },
  });
}

export function isAnalyticsEnabled(): boolean {
  return getActivePrivacySettings().telemetry;
}

export function applyAnalyticsConsent(): void {
  const allowed = isAnalyticsEnabled();
  if (allowed) {
    startSentry();
    try {
      posthog.opt_in_capturing();
    } catch {
      // PostHog might not be initialized yet
    }
  } else {
    try {
      posthog.opt_out_capturing();
    } catch {
      // PostHog might not be initialized yet
    }
  }
}

// React to Settings toggles without requiring a page reload
if (typeof window !== 'undefined') {
  window.addEventListener(BEDROCK_SETTINGS_UPDATED_EVENT, () => {
    applyAnalyticsConsent();
  });
}
