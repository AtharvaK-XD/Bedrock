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
    const cleanWords = handle.replace(/[0-9._-]+/g, ' ').trim().split(' ').filter(Boolean);
    if (cleanWords.length > 0) {
      return cleanWords.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  return 'Prompt Architect';
}

/**
 * Computes 2-letter uppercase avatar initials, avoiding 'US' from 'user_...'
 */
export function resolveInitials(name?: string | null): string {
  if (!name || name.startsWith('user_')) return 'PA';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'PA';
}

/**
 * Returns a clean, blank profile for a user starting on Bedrock
 */
export function getBlankProfile(userOrName?: any, email = '', joinedDate = ''): UserProfile {
  let nameStr = '';
  let emailStr = email || '';
  if (userOrName && typeof userOrName === 'object') {
    nameStr = userOrName.fullName || userOrName.firstName || '';
    emailStr = userOrName.primaryEmailAddress?.emailAddress || email || '';
  } else if (typeof userOrName === 'string') {
    nameStr = userOrName;
  }

  const cleanName = resolveCleanName(nameStr, emailStr);
  const cleanEmail = emailStr || '';
  const username = cleanEmail && !cleanEmail.endsWith('@clerk.user') 
    ? cleanEmail.split('@')[0] 
    : (cleanName !== 'Prompt Architect' ? cleanName.toLowerCase().replace(/\s+/g, '') : 'architect');

  return {
    name: cleanName,
    email: cleanEmail,
    username,
    role: 'Lead Prompt Architect',
    bio: '',
    plan: 'Free Plan',
    location: '',
    organization: '',
    avatarInitials: resolveInitials(cleanName),
    avatarUrl: '',
    github: '',
    huggingface: '',
    website: '',
    joinedDate: joinedDate || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function getStoredProfile(): UserProfile {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return getBlankProfile();
    const parsed = JSON.parse(item);
    
    // Auto-sanitize if previously cached as a Clerk user_ ID or email
    const cleanName = resolveCleanName(parsed.name, parsed.email);
    const cleanInitials = resolveInitials(cleanName);
    
    return {
      ...getBlankProfile(),
      ...parsed,
      name: cleanName,
      avatarInitials: (parsed.avatarInitials === 'US' || !parsed.avatarInitials) ? cleanInitials : parsed.avatarInitials,
    };
  } catch {
    return getBlankProfile();
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

          // Check if this is a brand new user signup or user switch
          const activeUserId = localStorage.getItem('bedrock_active_user_id');
          const isUserSwitch = activeUserId && activeUserId !== clerkUser.id;
          const isNewSignup = !localStorage.getItem(`bedrock_user_init_${clerkUser.id}`);

          if (isUserSwitch || isNewSignup) {
            localStorage.setItem('bedrock_active_user_id', clerkUser.id);
            localStorage.setItem(`bedrock_user_init_${clerkUser.id}`, 'true');

            if (isNewSignup) {
              // RESET ALL DEMO/PREVIOUS DATA FOR BRAND NEW SIGNUP
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem('bedrock_generator_history');
            }
          }
          
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
                'x-user-name': clerkUser?.fullName || clerkUser?.firstName || '',
              },
            });
            if (res.ok) {
              const data = await res.json();
              const cleanName = resolveCleanName(data.name, data.email || clerkUser?.primaryEmailAddress?.emailAddress);
              const cleanInitials = resolveInitials(cleanName);
              const merged: UserProfile = { 
                ...getBlankProfile(cleanName, data.email || clerkUser?.primaryEmailAddress?.emailAddress, data.joinedDate), 
                ...data,
                name: cleanName,
                avatarInitials: cleanInitials,
                avatarUrl: data.avatarUrl || clerkUser?.imageUrl || '',
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              setProfileState(merged);

              // If backend had returned a raw user_ ID, sync back the clean human name to Neon DB
              if (data.name && data.name.startsWith('user_') && cleanName && !cleanName.startsWith('user_')) {
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
    const blank = getBlankProfile();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blank));
    } catch (e) {
      console.error('Failed to reset user profile', e);
    }
    setProfileState(blank);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  };

  return {
    profile,
    updateProfile,
    resetProfile,
  };
}
