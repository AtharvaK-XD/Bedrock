import { useState, useEffect } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  username: string;
  role: string;
  bio: string;
  plan: string;
  location: string;
  organization: string;
  avatarInitials: string;
  github: string;
  huggingface: string;
  website: string;
  joinedDate: string;
}

const STORAGE_KEY = 'bedrock_user_profile';
const PROFILE_EVENT = 'bedrock_profile_update';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Atharva K.',
  email: 'atharva@example.com',
  username: 'atharvak',
  role: 'Lead Prompt Architect',
  bio: 'Architecting multi-model agentic pipelines and system prompt evaluation trees on Bedrock.',
  plan: 'Free Plan',
  location: 'San Francisco, CA (UTC-7)',
  organization: 'Bedrock Labs',
  avatarInitials: 'AK',
  github: 'atharva-k',
  huggingface: 'atharvak',
  website: 'https://bedrock.ai',
  joinedDate: 'January 2025',
};

function getStoredProfile(): UserProfile {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(item) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(getStoredProfile);

  useEffect(() => {
    const handleUpdate = () => {
      setProfileState(getStoredProfile());
    };

    window.addEventListener(PROFILE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(PROFILE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateProfile = (updates: Partial<UserProfile>) => {
    const current = getStoredProfile();
    const nextInitials = updates.name
      ? updates.name
          .split(' ')
          .filter(Boolean)
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : current.avatarInitials;

    const updated: UserProfile = {
      ...current,
      ...updates,
      avatarInitials: nextInitials || current.avatarInitials,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save user profile to localStorage', e);
    }

    setProfileState(updated);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  };

  const resetProfile = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
    } catch (e) {
      console.error('Failed to reset user profile', e);
    }
    setProfileState(DEFAULT_PROFILE);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  };

  return {
    profile,
    updateProfile,
    resetProfile,
  };
}
