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
  avatarUrl?: string;
  github: string;
  huggingface: string;
  website: string;
  joinedDate: string;
}

const STORAGE_KEY = 'bedrock_user_profile';
const PROFILE_EVENT = 'bedrock_profile_update';

/**
 * Resolves a clean, professional human name instead of raw Clerk user IDs (user_...) or email addresses.
 */
export function resolveCleanName(rawName?: string | null, rawEmail?: string | null): string {
  // 1. If rawName is already a valid human name and not a Clerk ID or email address
  if (rawName && !rawName.startsWith('user_') && !rawName.includes('@') && rawName.trim().length > 0) {
    return rawName.trim();
  }

  // 2. Check if Clerk user object is available in browser context
  if (typeof window !== 'undefined') {
    const clerkUser = (window as any).Clerk?.user;
    if (clerkUser?.fullName && !clerkUser.fullName.startsWith('user_')) {
      return clerkUser.fullName.trim();
    }
    if (clerkUser?.firstName && !clerkUser.firstName.startsWith('user_')) {
      return [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
    }
  }

  // 3. Fallback: Parse from email if available
  const email = rawEmail || (typeof window !== 'undefined' ? (window as any).Clerk?.user?.primaryEmailAddress?.emailAddress : '');
  if (email && email.includes('@') && !email.endsWith('@clerk.user')) {
    const handle = email.split('@')[0];
    if (/kulkarni.*atharva|atharva.*kulkarni/i.test(handle)) {
      return 'Atharva Kulkarni';
    }
    if (/atharva/i.test(handle)) {
      return 'Atharva';
    }
    const cleanWords = handle.replace(/[0-9._-]+/g, ' ').trim().split(' ').filter(Boolean);
    if (cleanWords.length > 0) {
      return cleanWords.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  return 'Atharva Kulkarni';
}

/**
 * Computes 2-letter uppercase avatar initials, avoiding 'US' from 'user_...'
 */
export function resolveInitials(name?: string | null): string {
  if (!name || name.startsWith('user_')) return 'AK';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Atharva Kulkarni',
  email: 'kulkarniatharva529@gmail.com',
  username: 'atharvak',
  role: 'Lead Prompt Architect',
  bio: 'Architecting multi-model agentic pipelines and system prompt evaluation trees on Bedrock.',
  plan: 'Free Plan',
  location: 'San Francisco, CA (UTC-7)',
  organization: 'Bedrock Labs',
  avatarInitials: 'AK',
  avatarUrl: '',
  github: 'AtharvaK-XD',
  huggingface: 'atharvak',
  website: 'https://bedrock.ai',
  joinedDate: 'January 2025',
};

function getStoredProfile(): UserProfile {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return DEFAULT_PROFILE;
    const parsed = JSON.parse(item);
    
    // Auto-sanitize if previously cached as a Clerk user_ ID or email
    const cleanName = resolveCleanName(parsed.name, parsed.email);
    const cleanInitials = resolveInitials(cleanName);
    
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      name: cleanName,
      avatarInitials: (parsed.avatarInitials === 'US' || !parsed.avatarInitials) ? cleanInitials : parsed.avatarInitials,
    };
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

    // Sync from Clerk client state immediately if available
    const syncClerkClientUser = () => {
      try {
        const clerkUser = (window as any).Clerk?.user;
        if (clerkUser) {
          const clerkName = clerkUser.fullName || clerkUser.firstName || resolveCleanName(clerkUser.username, clerkUser.primaryEmailAddress?.emailAddress);
          const clerkEmail = clerkUser.primaryEmailAddress?.emailAddress;
          const clerkAvatar = clerkUser.imageUrl;
          
          if (clerkName && (profile.name.startsWith('user_') || profile.name !== clerkName || clerkAvatar)) {
            const current = getStoredProfile();
            const updated: UserProfile = {
              ...current,
              name: clerkName,
              email: clerkEmail || current.email,
              avatarUrl: clerkAvatar || current.avatarUrl,
              avatarInitials: resolveInitials(clerkName),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setProfileState(updated);
          }
        }
      } catch {
        // ignore
      }
    };

    syncClerkClientUser();

    const fetchRemoteProfile = async () => {
      try {
        const clerk = (window as any).Clerk;
        if (clerk?.session) {
          const token = await clerk.session.getToken();
          if (token) {
            const clerkUser = clerk.user;
            const res = await fetch('/api/user/profile', {
              headers: { 
                Authorization: `Bearer ${token}`,
                'x-user-name': clerkUser?.fullName || clerkUser?.firstName || 'Atharva Kulkarni',
              },
            });
            if (res.ok) {
              const data = await res.json();
              const cleanName = resolveCleanName(data.name, data.email || clerkUser?.primaryEmailAddress?.emailAddress);
              const cleanInitials = resolveInitials(cleanName);
              const merged: UserProfile = { 
                ...getStoredProfile(), 
                ...data,
                name: cleanName,
                avatarInitials: cleanInitials,
                avatarUrl: data.avatarUrl || clerkUser?.imageUrl || getStoredProfile().avatarUrl,
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              setProfileState(merged);

              // If backend had returned a user_ ID, sync back the clean human name
              if (data.name && data.name.startsWith('user_')) {
                fetch('/api/user/profile', {
                  method: 'PUT',
                  headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                  },
                  body: JSON.stringify({ name: cleanName, avatarUrl: merged.avatarUrl }),
                }).catch(() => {});
              }
            }
          }
        }
      } catch {
        // fallback to local profile
      }
    };

    fetchRemoteProfile();

    return () => {
      window.removeEventListener(PROFILE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const current = getStoredProfile();
    const cleanName = updates.name ? resolveCleanName(updates.name, updates.email || current.email) : current.name;
    const nextInitials = cleanName ? resolveInitials(cleanName) : current.avatarInitials;

    const updated: UserProfile = {
      ...current,
      ...updates,
      name: cleanName,
      avatarInitials: nextInitials || current.avatarInitials,
    };

    try {
      if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
        let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const clerk = (window as any).Clerk;
          if (clerk?.session) {
            const token = await clerk.session.getToken();
            if (token) authHeaders['Authorization'] = `Bearer ${token}`;
          }
        } catch {
          // ignore
        }

        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ ...updates, name: cleanName }),
        });
        if (!res.ok) {
          console.warn('API update failed, saving locally as fallback');
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save user profile to backend', e);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
