import { useState, useEffect, useCallback } from 'react';
import { useUserProfile } from './useUserProfile';

export const FREE_TIER_SESSION_LIMIT = 10;
export const FREE_TIER_WEEKLY_LIMIT = 50;
export const PRO_TIER_SESSION_LIMIT = 500;
export const PRO_TIER_WEEKLY_LIMIT = 2000;

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

export function getNextSessionReset(now = Date.now()): number {
  return (Math.floor(now / FIVE_HOURS_MS) + 1) * FIVE_HOURS_MS;
}

export function getNextWeeklyReset(now = new Date()): number {
  const next = new Date(now);
  const daysUntilNextSunday = (7 - now.getDay()) % 7;
  next.setDate(now.getDate() + (daysUntilNextSunday === 0 ? 7 : daysUntilNextSunday));
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const STORAGE_KEYS = {
  SESSION_PROMPTS: 'bedrock_session_prompts',
  WEEKLY_PROMPTS: 'bedrock_weekly_prompts',
  SESSION_RESET_TIME: 'bedrock_session_reset_time',
  WEEKLY_RESET_TIME: 'bedrock_weekly_reset_time',
};

const QUOTA_EVENT = 'bedrock_quota_updated';

interface QuotaState {
  sessionPrompts: number;
  weeklyPrompts: number;
  sessionResetTime: number;
  weeklyResetTime: number;
}

function getStoredQuota(): QuotaState {
  const now = Date.now();
  let sessionReset = parseInt(localStorage.getItem(STORAGE_KEYS.SESSION_RESET_TIME) || '0', 10);
  let weeklyReset = parseInt(localStorage.getItem(STORAGE_KEYS.WEEKLY_RESET_TIME) || '0', 10);

  let sessionPrompts = parseInt(localStorage.getItem(STORAGE_KEYS.SESSION_PROMPTS) || '0', 10);
  let weeklyPrompts = parseInt(localStorage.getItem(STORAGE_KEYS.WEEKLY_PROMPTS) || '0', 10);

  // If session reset time is missing or passed, reset session prompts
  if (!sessionReset || now >= sessionReset) {
    sessionPrompts = 0;
    sessionReset = getNextSessionReset(now);
    localStorage.setItem(STORAGE_KEYS.SESSION_PROMPTS, '0');
    localStorage.setItem(STORAGE_KEYS.SESSION_RESET_TIME, sessionReset.toString());
  }

  // If weekly reset time is missing or passed, reset weekly prompts
  if (!weeklyReset || now >= weeklyReset) {
    weeklyPrompts = 0;
    weeklyReset = getNextWeeklyReset(new Date(now));
    localStorage.setItem(STORAGE_KEYS.WEEKLY_PROMPTS, '0');
    localStorage.setItem(STORAGE_KEYS.WEEKLY_RESET_TIME, weeklyReset.toString());
  }

  return {
    sessionPrompts,
    weeklyPrompts,
    sessionResetTime: sessionReset,
    weeklyResetTime: weeklyReset,
  };
}

export function usePromptQuota() {
  const { profile } = useUserProfile();
  const [quota, setQuota] = useState<QuotaState>(getStoredQuota);
  const [timeUntilSession, setTimeUntilSession] = useState('');
  const [timeUntilWeekly, setTimeUntilWeekly] = useState('');

  // Check whether user is on the Free tier
  const isFreeTier = !profile?.plan || profile.plan.toLowerCase().includes('free');

  const sessionLimit = isFreeTier ? FREE_TIER_SESSION_LIMIT : PRO_TIER_SESSION_LIMIT;
  const weeklyLimit = isFreeTier ? FREE_TIER_WEEKLY_LIMIT : PRO_TIER_WEEKLY_LIMIT;

  const refreshQuota = useCallback(() => {
    const current = getStoredQuota();
    setQuota(current);

    const now = Date.now();
    const sessionDiff = Math.max(0, current.sessionResetTime - now);
    const weeklyDiff = Math.max(0, current.weeklyResetTime - now);

    setTimeUntilSession(formatTimeRemaining(sessionDiff));
    setTimeUntilWeekly(formatTimeRemaining(weeklyDiff));
  }, []);

  useEffect(() => {
    refreshQuota();

    const handleUpdate = () => refreshQuota();
    window.addEventListener(QUOTA_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Update countdown timers every 30 seconds
    const interval = setInterval(refreshQuota, 30000);

    return () => {
      window.removeEventListener(QUOTA_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [refreshQuota]);

  const recordPromptUsage = useCallback((count = 1): boolean => {
    const current = getStoredQuota();

    if (isFreeTier && (current.sessionPrompts >= sessionLimit || current.weeklyPrompts >= weeklyLimit)) {
      return false;
    }

    const newSession = Math.min(current.sessionPrompts + count, sessionLimit);
    const newWeekly = Math.min(current.weeklyPrompts + count, weeklyLimit);

    localStorage.setItem(STORAGE_KEYS.SESSION_PROMPTS, newSession.toString());
    localStorage.setItem(STORAGE_KEYS.WEEKLY_PROMPTS, newWeekly.toString());

    setQuota({
      ...current,
      sessionPrompts: newSession,
      weeklyPrompts: newWeekly,
    });

    window.dispatchEvent(new CustomEvent(QUOTA_EVENT));
    return true;
  }, [isFreeTier, sessionLimit, weeklyLimit]);

  const resetQuota = useCallback(() => {
    const now = Date.now();
    const sessionReset = getNextSessionReset(now);
    const weeklyReset = getNextWeeklyReset(new Date(now));

    localStorage.setItem(STORAGE_KEYS.SESSION_PROMPTS, '0');
    localStorage.setItem(STORAGE_KEYS.WEEKLY_PROMPTS, '0');
    localStorage.setItem(STORAGE_KEYS.SESSION_RESET_TIME, sessionReset.toString());
    localStorage.setItem(STORAGE_KEYS.WEEKLY_RESET_TIME, weeklyReset.toString());

    setQuota({
      sessionPrompts: 0,
      weeklyPrompts: 0,
      sessionResetTime: sessionReset,
      weeklyResetTime: weeklyReset,
    });

    window.dispatchEvent(new CustomEvent(QUOTA_EVENT));
  }, []);

  const isSessionLimitReached = isFreeTier && quota.sessionPrompts >= sessionLimit;
  const isWeeklyLimitReached = isFreeTier && quota.weeklyPrompts >= weeklyLimit;
  const isLimitReached = isSessionLimitReached || isWeeklyLimitReached;

  const sessionPercent = Math.min(100, Math.round((quota.sessionPrompts / sessionLimit) * 100));
  const weeklyPercent = Math.min(100, Math.round((quota.weeklyPrompts / weeklyLimit) * 100));

  return {
    sessionPrompts: quota.sessionPrompts,
    weeklyPrompts: quota.weeklyPrompts,
    sessionLimit,
    weeklyLimit,
    sessionPercent,
    weeklyPercent,
    timeUntilSession,
    timeUntilWeekly,
    isFreeTier,
    isSessionLimitReached,
    isWeeklyLimitReached,
    isLimitReached,
    recordPromptUsage,
    resetQuota,
    refreshQuota,
  };
}
