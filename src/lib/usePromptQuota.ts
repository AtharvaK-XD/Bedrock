import { useState, useEffect, useCallback } from 'react';

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
  const [quota, setQuota] = useState<QuotaState>(getStoredQuota);
  const [timeUntilSession, setTimeUntilSession] = useState('');
  const [timeUntilWeekly, setTimeUntilWeekly] = useState('');

  // Under BYOK Workstation mode, quota limits are completely uncapped
  const isFreeTier = false;
  const sessionLimit = Infinity;
  const weeklyLimit = Infinity;

  const refreshQuota = useCallback(() => {
    const current = getStoredQuota();
    setQuota(current);
    setTimeUntilSession('Unlimited');
    setTimeUntilWeekly('Unlimited');
  }, []);

  useEffect(() => {
    refreshQuota();

    const handleUpdate = () => refreshQuota();
    window.addEventListener(QUOTA_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(QUOTA_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshQuota]);

  const recordPromptUsage = useCallback((count = 1): boolean => {
    const current = getStoredQuota();
    const newSession = current.sessionPrompts + count;
    const newWeekly = current.weeklyPrompts + count;

    localStorage.setItem(STORAGE_KEYS.SESSION_PROMPTS, newSession.toString());
    localStorage.setItem(STORAGE_KEYS.WEEKLY_PROMPTS, newWeekly.toString());

    setQuota({
      ...current,
      sessionPrompts: newSession,
      weeklyPrompts: newWeekly,
    });

    window.dispatchEvent(new CustomEvent(QUOTA_EVENT));
    return true;
  }, []);

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

  const isSessionLimitReached = false;
  const isWeeklyLimitReached = false;
  const isLimitReached = false;

  const sessionPercent = 0;
  const weeklyPercent = 0;

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
