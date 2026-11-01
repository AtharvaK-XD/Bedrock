import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { BEDROCK_SETTINGS_UPDATED_EVENT, getActivePrivacySettings } from './appSettings';

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
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app/,
      /^https:\/\/bedrockxai\.com/,
    ],
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

/** True when the user allows crash reports and analytics (the default). */
export function isAnalyticsEnabled(): boolean {
  return getActivePrivacySettings().telemetry === true;
}

/** Starts or stops Sentry and PostHog to match the current setting. Safe to call repeatedly. */
export function applyAnalyticsConsent(): void {
  const enabled = isAnalyticsEnabled();
  try {
    if (enabled) {
      startSentry();
      if (posthog.has_opted_out_capturing?.()) posthog.opt_in_capturing();
    } else {
      if (sentryStarted) {
        void Sentry.close();
        sentryStarted = false;
      }
      posthog.opt_out_capturing?.();
    }
  } catch (e) {
    console.warn('[Analytics] Could not apply the consent setting:', e);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(BEDROCK_SETTINGS_UPDATED_EVENT, applyAnalyticsConsent);
}
