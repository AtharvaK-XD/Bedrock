import {
  getActiveNotificationSettings,
  playCompletionChime,
} from './appSettings';
import { isDesktopApp } from './platform';

export const TOAST_EVENT = 'bedrock_toast';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastDetail {
  message: string;
  kind: ToastKind;
}

/** Shows a small message at the bottom of the screen (rendered by <SyncNotice />). */
export function showToast(message: string, kind: ToastKind = 'info'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, kind } }));
}

// Runs slower than this get a "slow response" warning, runs longer than the second value count as "lengthy"
const SLOW_RESPONSE_MS = 2500;
const LENGTHY_RUN_MS = 8000;

/** Operating-system notifications work in the browser. The desktop app blocks them, so the option is hidden there. */
export function osNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && !isDesktopApp();
}

/** Asks the browser for permission to show system notifications. Called when the user switches the option on. */
export async function requestOsNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!osNotificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function sendOsNotification(title: string, body: string): void {
  if (!osNotificationsSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/logo-tight.png' });
  } catch {
    // Some browsers only allow notifications from a service worker
  }
}

/**
 * Called when a generation, refinement or test run finishes. Applies the Notifications settings:
 * lengthy-run alerts, slow-response warnings, the completion chime and system notifications.
 */
export function announceRunFinished(params: { latencyMs: number; ok: boolean }): void {
  if (typeof window === 'undefined') return;
  const settings = getActiveNotificationSettings();
  const { latencyMs, ok } = params;
  const inBackground = typeof document !== 'undefined' && document.hidden;

  if (ok) {
    playCompletionChime();
    if (settings.latencyAlerts && latencyMs > SLOW_RESPONSE_MS) {
      showToast(`That response was slow (${(latencyMs / 1000).toFixed(1)} s). The provider may be busy.`, 'warning');
    }
    if (settings.executionAlerts && (inBackground || latencyMs > LENGTHY_RUN_MS)) {
      showToast('Your run has finished.', 'success');
      if (settings.desktopNotifications && inBackground) {
        sendOsNotification('Bedrock', 'Your run has finished.');
      }
    }
  }
}
