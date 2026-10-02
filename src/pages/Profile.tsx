import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, Camera, UploadCloud, Trash2 } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { useUserProfile, resolveCleanName, resolveInitials, getBlankProfile } from '../lib/useUserProfile';
import { useUser } from '@clerk/react';
import { PromptActivityHeatmap } from '../components/profile/PromptActivityHeatmap';
import { processAvatarImage } from '../lib/imageUtils';
import { AgentIcon } from '../components/ui/ModelLogos';
import { getUserTelemetry, TELEMETRY_UPDATE_EVENT, type UserTelemetrySummary } from '../lib/telemetry';
import { syncHistoryFromDb, HISTORY_UPDATE_EVENT, type HistoryPromptItem } from '../lib/generatorHistory';

const BANNER_THEMES = [
  {
    id: 'copper',
    name: 'Bedrock Aurora',
    gradient: 'from-[#0a1816] via-[#122622] to-[#0a1318]',
    radial1: 'from-copper-500/30 via-emerald-500/10 to-transparent',
    radial2: 'from-copper-600/20 via-transparent to-transparent',
    gridColor: '#4FB0A1',
    meshOpacity: 'opacity-25',
    accentColor: 'text-copper-300',
    badgeBorder: 'border-copper-500/30',
    dotBg: 'bg-copper-400',
  },
  {
    id: 'cyber',
    name: 'Cyber Emerald',
    gradient: 'from-[#051a13] via-[#0a291f] to-[#071514]',
    radial1: 'from-emerald-400/30 via-teal-500/10 to-transparent',
    radial2: 'from-emerald-600/20 via-transparent to-transparent',
    gridColor: '#34d399',
    meshOpacity: 'opacity-25',
    accentColor: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    dotBg: 'bg-emerald-400',
  },
  {
    id: 'nebula',
    name: 'Deep Nebula',
    gradient: 'from-[#120f26] via-[#1b1538] to-[#0a0d1c]',
    radial1: 'from-indigo-500/30 via-purple-500/10 to-transparent',
    radial2: 'from-purple-600/20 via-transparent to-transparent',
    gridColor: '#818cf8',
    meshOpacity: 'opacity-25',
    accentColor: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    dotBg: 'bg-indigo-400',
  },
  {
    id: 'solar',
    name: 'Solar Amber',
    gradient: 'from-[#201407] via-[#2c1c0b] to-[#120d09]',
    radial1: 'from-amber-500/30 via-orange-500/10 to-transparent',
    radial2: 'from-amber-600/20 via-transparent to-transparent',
    gridColor: '#fbbf24',
    meshOpacity: 'opacity-25',
    accentColor: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    dotBg: 'bg-amber-400',
  },
];

const SPECIALIZATION_TAGS = [
  'Multi-Agent Workflows',
  'Tree-of-Thought Eval',
  'Prompt Distillation',
  'Gemini 2.5 & Llama 3.1',
  'DSPy Pipelines',
  'Adaptive Routing',
];

type Tab = 'overview' | 'edit' | 'usage' | 'preferences';

export default function Profile() {
  const { profile, updateProfile, resetProfile } = useUserProfile();
  const { user: clerkUser } = useUser();
  const effectiveName = 
    clerkUser?.fullName || 
    clerkUser?.firstName || 
    resolveCleanName(profile.name, clerkUser?.primaryEmailAddress?.emailAddress || profile.email);
  const effectiveAvatar = profile.avatarUrl || clerkUser?.imageUrl;
  const effectiveInitials = resolveInitials(effectiveName);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [bannerTheme, setBannerTheme] = useState('copper');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const [telemetry, setTelemetry] = useState<UserTelemetrySummary>({
    totalInferences: 0,
    totalTokens: 0,
    avgLatency: 0,
    p99Latency: 0,
    reliability: 100,
    activeModelsCount: 0,
    activeModels: [],
    traces: [],
  });
  const [prompts, setPrompts] = useState<HistoryPromptItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadUserData = async () => {
      const [syncedPrompts, userTelem] = await Promise.all([
        syncHistoryFromDb(),
        getUserTelemetry(),
      ]);
      if (isMounted) {
        setPrompts(syncedPrompts);
        setTelemetry(userTelem);
      }
    };
    loadUserData();

    const handleTelemUpdate = (e: any) => {
      if (e.detail) setTelemetry(e.detail);
    };
    const handleHistUpdate = (e: any) => {
      if (e.detail) setPrompts(e.detail);
    };

    window.addEventListener(TELEMETRY_UPDATE_EVENT, handleTelemUpdate);
    window.addEventListener(HISTORY_UPDATE_EVENT, handleHistUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(TELEMETRY_UPDATE_EVENT, handleTelemUpdate);
      window.removeEventListener(HISTORY_UPDATE_EVENT, handleHistUpdate);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    }
    if (showThemePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemePicker]);

  const [formData, setFormData] = useState({
    name: profile.name,
    username: profile.username,
    role: profile.role,
    organization: profile.organization,
    bio: profile.bio,
    location: profile.location,
    email: profile.email,
    github: profile.github,
    huggingface: profile.huggingface,
  });

  useEffect(() => {
    setFormData({
      name: profile.name,
      username: profile.username,
      role: profile.role,
      organization: profile.organization,
      bio: profile.bio,
      location: profile.location,
      email: profile.email,
      github: profile.github,
      huggingface: profile.huggingface,
    });
  }, [profile]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeTheme = BANNER_THEMES.find((t) => t.id === bannerTheme) || BANNER_THEMES[0];

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(profile.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleShareProfile = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const processAndSetPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setPhotoMessage({
        type: 'error',
        text: 'Please select a valid image file (PNG, JPG, WEBP, or GIF).'
      });
      setTimeout(() => setPhotoMessage(null), 4000);
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setPhotoMessage(null);
      const dataUrl = await processAvatarImage(file);
      await updateProfile({ avatarUrl: dataUrl });

      // If user is authenticated via Clerk, also attempt cloud profile sync in background
      if (clerkUser && typeof (clerkUser as any).setProfileImage === 'function') {
        (clerkUser as any).setProfileImage({ file }).catch((err: any) => {
          console.warn('Clerk background avatar sync optional fallback:', err);
        });
      }

      setPhotoMessage({ type: 'success', text: 'Profile photo updated successfully!' });
      setTimeout(() => setPhotoMessage(null), 3000);
    } catch (err: any) {
      setPhotoMessage({
        type: 'error',
        text: err?.message || 'Failed to process image from your computer.'
      });
      setTimeout(() => setPhotoMessage(null), 4000);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAndSetPhoto(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processAndSetPhoto(file);
    }
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateProfile({ avatarUrl: '' });
      setPhotoMessage({ type: 'success', text: 'Custom photo removed (reverted to default)' });
      setTimeout(() => setPhotoMessage(null), 2500);
    } catch (err: any) {
      console.error('Failed to remove photo', err);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    updateProfile(formData);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('overview');
      }, 1500);
    }, 600);
  };

  const handleReset = () => {
    if (confirm('Reset profile to factory defaults?')) {
      const blank = getBlankProfile(clerkUser);
      resetProfile();
      setFormData({
        name: blank.name,
        username: blank.username,
        role: blank.role,
        organization: blank.organization,
        bio: blank.bio,
        location: blank.location,
        email: blank.email,
        github: blank.github,
        huggingface: blank.huggingface,
      });
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview & Activity' },
    { id: 'edit', label: 'Edit Profile' },
    { id: 'usage', label: 'Plan & Quotas' },
    { id: 'preferences', label: 'Model Preferences' },
  ];

  return (
    <PageTransition>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 lg:py-12">
        {/* Top Breadcrumb & Share Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-wider">
            <Link to="/app" className="hover:text-white transition-colors">Workspace</Link>
            <span>/</span>
            <span className="text-white font-semibold">User Profile</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <button 
              onClick={handleShareProfile}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors uppercase tracking-wider"
            >
              {copiedLink ? 'Link Copied' : 'Share Profile'}
            </button>
            <Link 
              to="/app/settings"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors uppercase tracking-wider"
            >
              Settings
            </Link>
          </div>
        </div>

        {/* HERO PROFILE CARD */}
        <div className="relative rounded-3xl border border-white/10 bg-[#121417]/85 backdrop-blur-2xl overflow-hidden shadow-2xl mb-8 group/card transition-all duration-300">
          {/* Ambient Banner Backdrop */}
          <div className="relative h-44 sm:h-52 w-full z-10 pointer-events-none">
            {/* Background layers clipped to banner top rounded corners */}
            <div className={cn(
              "absolute inset-0 overflow-hidden rounded-t-3xl bg-gradient-to-r transition-all duration-700 pointer-events-none",
              activeTheme.gradient
            )}>
              <div className={cn("absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] transition-all duration-500", activeTheme.radial1)} />
              <div className={cn("absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_var(--tw-gradient-stops))] transition-all duration-500", activeTheme.radial2)} />
            </div>
            
            {/* Top-Right Theme & Status Controls (Unclipped & elevated above profile card body) */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2.5 z-20 pointer-events-auto">
              <div className="relative" ref={themePickerRef}>
                <button
                  type="button"
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className="px-3 py-1.5 rounded-full text-xs font-mono font-medium bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white border border-white/15 backdrop-blur-md shadow-sm transition-all cursor-pointer uppercase tracking-wider"
                >
                  Theme
                </button>

                {showThemePicker && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#15181b]/98 backdrop-blur-2xl border border-white/20 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 space-y-1 font-mono">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 px-2.5 py-1">Banner Theme</p>
                    {BANNER_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setBannerTheme(theme.id);
                          setShowThemePicker(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer",
                          bannerTheme === theme.id 
                            ? "bg-white/10 text-white font-semibold" 
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", theme.dotBg)} />
                          <span>{theme.name}</span>
                        </div>
                        {bannerTheme === theme.id && <Check className="w-3.5 h-3.5 text-copper-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Verified Member Badge */}
              <span className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-black/60 backdrop-blur-md shadow-sm border transition-all uppercase tracking-wider",
                activeTheme.accentColor,
                activeTheme.badgeBorder
              )}>
                Bedrock Architect
              </span>
            </div>
          </div>

          {/* Profile Header Content (Elevated above banner at z-30 to prevent clipping) */}
          <div className="px-6 sm:px-10 pb-7 pt-0 relative z-30">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16 sm:-mt-20 mb-6">
              
              {/* Avatar & Main Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-6 flex-1 min-w-0">
                
                {/* Avatar with Status Dot and PC Upload Trigger */}
                <div 
                  className={cn(
                    "relative group cursor-pointer shrink-0 z-30 transition-transform",
                    isDragging && "scale-105"
                  )}
                  onClick={handleAvatarClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  title="Click or drag an image here to change profile photo from PC"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoSelect} 
                    accept="image/png, image/jpeg, image/webp, image/gif, image/*" 
                    className="hidden" 
                    id="profile-avatar-upload"
                  />
                  <div className={cn(
                    "relative p-1 rounded-3xl bg-gradient-to-tr shadow-2xl ring-4 ring-[#121417] transition-all",
                    isDragging 
                      ? "from-emerald-400 via-copper-400 to-copper-500 ring-emerald-500/50" 
                      : "from-copper-400 via-copper-500 to-emerald-400"
                  )}>
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[22px] bg-gradient-to-tr from-basalt-900 via-[#162724] to-basalt-800 text-white flex flex-col items-center justify-center font-display font-bold text-3xl sm:text-4xl relative overflow-hidden border border-white/10 group-hover:border-copper-400/60 transition-all">
                      {effectiveAvatar ? (
                        <img 
                          src={effectiveAvatar} 
                          alt={effectiveName} 
                          className="w-full h-full object-cover relative z-0" 
                        />
                      ) : (
                        <span>{effectiveInitials}</span>
                      )}
                      
                      {/* Hover / Drag edit badge overlay */}
                      <div className={cn(
                        "absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200 z-20 backdrop-blur-[2px]",
                        isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        {isUploadingPhoto ? (
                          <div className="w-6 h-6 border-2 border-white/20 border-t-copper-400 rounded-full animate-spin" />
                        ) : isDragging ? (
                          <>
                            <UploadCloud className="w-6 h-6 text-emerald-400 animate-bounce" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                              Drop image
                            </span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-6 h-6 text-copper-300" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-white font-medium">
                              Upload from PC
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {profile.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      title="Remove custom photo"
                      className="absolute -top-1.5 -right-1.5 z-30 p-1.5 rounded-full bg-[#121417] text-gray-400 hover:text-rose-400 border border-white/20 hover:border-rose-500/40 shadow-lg text-xs font-mono leading-none opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Identity & Metadata Details */}
                <div className="space-y-1.5 flex-1 min-w-0 z-30">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                      {effectiveName}
                    </h1>

                    {/* Interactive Handle Copy */}
                    <button
                      onClick={handleCopyHandle}
                      className="group/handle inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                      title="Click to copy handle"
                    >
                      <span>@{profile.username || clerkUser?.username || clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'architect'}</span>
                      {copiedHandle && <span className="text-copper-400 font-bold">(copied)</span>}
                    </button>

                    {/* Plan Badge */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold bg-copper-500/15 text-copper-300 border border-copper-500/30">
                      {profile.plan || 'Free Plan'}
                    </span>

                    {photoMessage && (
                      <span className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold border shadow-sm",
                        photoMessage.type === 'success'
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-red-500/20 text-red-300 border-red-500/40"
                      )}>
                        {photoMessage.text}
                      </span>
                    )}
                  </div>

                  {/* Role & Company */}
                  <p className="text-sm sm:text-base text-gray-300 font-medium flex flex-wrap items-center gap-2">
                    <span className="text-white font-semibold">{profile.role || 'Lead Prompt Architect'}</span>
                    {profile.organization && profile.organization.trim().length > 0 && (
                      <>
                        <span className="text-gray-500">at</span>
                        <span className="text-gray-300 font-mono text-sm">{profile.organization}</span>
                      </>
                    )}
                  </p>

                  {/* Metadata Row: Location, Joined, Email */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-gray-400 pt-1">
                    {profile.location && profile.location.trim().length > 0 && (
                      <>
                        <span className="text-gray-300">{profile.location}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>Joined {profile.joinedDate || 'September 2026'}</span>
                    <span>•</span>
                    <button 
                      onClick={handleCopyEmail}
                      className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title="Click to copy email"
                    >
                      {clerkUser?.primaryEmailAddress?.emailAddress || profile.email} {copiedEmail && <span className="text-copper-400 font-bold">(copied)</span>}
                    </button>
                    {profile.github && (
                      <>
                        <span>•</span>
                        <a 
                          href={`https://github.com/${profile.github}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-400 hover:text-white transition-colors hover:underline"
                        >
                          gh/{profile.github}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 self-start md:self-end shrink-0 font-mono text-xs">
                <button
                  onClick={() => setActiveTab(activeTab === 'edit' ? 'overview' : 'edit')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-semibold uppercase tracking-wider transition-all duration-200 border cursor-pointer",
                    activeTab === 'edit'
                      ? "bg-white text-black hover:bg-gray-200 border-white shadow-lg"
                      : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20"
                  )}
                >
                  {activeTab === 'edit' ? 'Close Edit' : 'Edit Profile'}
                </button>

                <Link
                  to="/app/pricing"
                  className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-white bg-copper-500 hover:bg-copper-600 transition-all shadow-md shadow-copper-500/20"
                >
                  Upgrade Plan
                </Link>
              </div>
            </div>

            {/* Bio summary & Specialization Tags */}
            <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
              <div className="pl-3.5 border-l-2 border-copper-400/80 py-0.5">
                <p className="text-sm text-gray-300 leading-relaxed italic">
                  {profile.bio && profile.bio.trim().length > 0
                    ? `"${profile.bio}"`
                    : "No bio added yet. Click 'Edit Profile' to customize your bio, specialization, and handle."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 font-mono">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 mr-1">
                  Focus:
                </span>
                {SPECIALIZATION_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar - Telemetry HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-white/10 bg-black/40 backdrop-blur-md divide-y sm:divide-y-0 sm:divide-x divide-white/5 font-mono">
            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Prompts Built</div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{prompts.length}</p>
              <p className="text-[10px] text-gray-500 mt-1">{prompts.length > 0 ? `${prompts.length} in library` : '0 in library'}</p>
            </div>

            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Inferences</div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{telemetry.totalInferences.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500 mt-1">{telemetry.totalInferences > 0 ? 'Telemetry active' : 'No runs yet'}</p>
            </div>

            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Tokens Used</div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {telemetry.totalTokens >= 1000000 
                  ? `${(telemetry.totalTokens / 1000000).toFixed(1)}M` 
                  : telemetry.totalTokens >= 1000 
                    ? `${(telemetry.totalTokens / 1000).toFixed(1)}k` 
                    : telemetry.totalTokens.toString()}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {telemetry.totalTokens > 0 
                  ? `${Math.min(100, Math.round((telemetry.totalTokens / 10000) * 100))}% free tier` 
                  : '0% free tier'}
              </p>
            </div>

            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Reliability</div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
                {telemetry.totalInferences > 0 ? `${telemetry.reliability}%` : '100%'}
              </p>
              <p className="text-[10px] text-emerald-500 mt-1">
                {telemetry.totalInferences > 0 ? 'Verified SLA' : 'Nominal standby'}
              </p>
            </div>

            <div className="p-4 sm:p-5 col-span-2 sm:col-span-1 hover:bg-white/[0.03] transition-all">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Avg Latency</div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {telemetry.avgLatency > 0 ? `${telemetry.avgLatency}ms` : '—'}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {telemetry.p99Latency > 0 ? `p99: ${telemetry.p99Latency}ms` : 'Awaiting runs'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-8 overflow-x-auto font-mono text-xs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-xl uppercase tracking-wider font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-white text-black shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left 2 Cols */}
                <div className="lg:col-span-2 space-y-8">
                  <PromptActivityHeatmap activityTimestamps={prompts.map(p => p.createdAt)} />

                  {/* Recent Pipeline & Prompt Runs */}
                  <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-base font-bold text-white">
                        Recent Pipeline & Prompt Runs
                      </h2>
                      <Link to="/app/library" className="text-xs font-mono uppercase tracking-wider text-copper-400 hover:text-copper-300">
                        View All &rarr;
                      </Link>
                    </div>

                    {prompts.length > 0 ? (
                      <div className="space-y-3">
                        {prompts.slice(0, 5).map((prompt) => (
                          <Link
                            key={prompt.id}
                            to="/app/generator"
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white group-hover:text-copper-300 transition-colors text-sm">
                                  {prompt.title}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                                  Prompt Synthesis
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                                <span className="flex items-center gap-1.5 text-gray-400">
                                  <AgentIcon model="gemini-2.5-flash" className="w-3 h-3" badgeClassName="w-4 h-4 bg-white/5 border-white/10" />
                                  <span>Bedrock Engine</span>
                                </span>
                                <span>•</span>
                                <span>{new Date(prompt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                                Saved in DB
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                        <p className="text-sm font-semibold text-white mb-1">No prompt activity yet</p>
                        <p className="text-xs font-mono text-gray-400 max-w-sm mx-auto mb-4">
                          Synthesize or test your first prompt to start building your personal telemetry and history.
                        </p>
                        <Link
                          to="/app/generator"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-copper-500 hover:bg-copper-600 text-white transition-all shadow-md shadow-copper-500/20 uppercase tracking-wider"
                        >
                          Open Prompt Generator &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Model Allocation & Quota */}
                <div className="space-y-8">
                  {/* Model Distribution Card */}
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <h2 className="text-base font-bold text-white mb-1">
                      Model Utilization
                    </h2>
                    <p className="text-xs text-gray-400 mb-6 font-mono">Execution share across integrated models</p>

                    {telemetry.activeModels && telemetry.activeModels.length > 0 ? (
                      <div className="space-y-4">
                        {telemetry.activeModels.map((model, idx) => {
                          const pct = Math.round(100 / telemetry.activeModels.length);
                          const colors = ['bg-copper-400 text-copper-400', 'bg-cyan-400 text-cyan-400', 'bg-sky-400 text-sky-400'];
                          const [barBg, textCol] = colors[idx % colors.length].split(' ');
                          return (
                            <div key={model}>
                              <div className="flex justify-between text-xs font-mono mb-1.5">
                                <span className="text-white font-medium">{model}</span>
                                <span className={cn("font-bold", textCol)}>{pct}%</span>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full", barBg)} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                        <p className="text-xs font-mono text-gray-400">No model runs recorded yet</p>
                        <p className="text-[10px] text-gray-500 mt-1 font-mono">Run inferences to populate real metrics</p>
                      </div>
                    )}

                    <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-400">Routing Mode:</span>
                      <span className="font-semibold text-white">Latency-Optimized</span>
                    </div>
                  </div>

                  {/* Monthly Resource Quota Widget */}
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-bold text-white">
                        Plan Resource Usage
                      </h2>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-white/10 text-gray-300">
                        {profile.plan || 'Free Plan'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-gray-400">Monthly Tokens</span>
                          <span className="text-white font-semibold">
                            {telemetry.totalTokens.toLocaleString()} / 10,000 ({Math.min(100, Math.round((telemetry.totalTokens / 10000) * 100))}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, Math.round((telemetry.totalTokens / 10000) * 100))}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-gray-400">Daily Runs Quota</span>
                          <span className="text-white font-semibold">{telemetry.totalInferences} / 20 used</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-copper-500 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, Math.round((telemetry.totalInferences / 20) * 100))}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-gray-400">Branch Max Depth</span>
                          <span className="text-white font-semibold">3 Levels (Pro: Unlimited)</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-2 font-mono">
                      <Link
                        to="/app/pricing"
                        className="w-full py-2.5 px-4 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-semibold text-xs text-center uppercase tracking-wider transition-all"
                      >
                        Unlock Unlimited with Pro
                      </Link>
                      <Link
                        to="/app/billing"
                        className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium text-xs text-center border border-white/10 uppercase tracking-wider transition-colors"
                      >
                        View Billing
                      </Link>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4">
                      Connected Integrations
                    </h2>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div>
                          <p className="font-semibold text-white">GitHub</p>
                          <p className="text-[10px] text-gray-400">
                            {profile.github ? `@${profile.github}` : 'Not linked'}
                          </p>
                        </div>
                        {profile.github ? (
                          <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/40 rounded border border-emerald-800/40">
                            Connected
                          </span>
                        ) : (
                          <button
                            onClick={() => setActiveTab('edit')}
                            className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 bg-white/5 rounded border border-white/10 hover:border-white/20 transition-colors"
                          >
                            Link Account
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div>
                          <p className="font-semibold text-white">HuggingFace</p>
                          <p className="text-[10px] text-gray-400">
                            {profile.huggingface ? `@${profile.huggingface}` : 'Not linked'}
                          </p>
                        </div>
                        {profile.huggingface ? (
                          <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/40 rounded border border-emerald-800/40">
                            Connected
                          </span>
                        ) : (
                          <button
                            onClick={() => setActiveTab('edit')}
                            className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 bg-white/5 rounded border border-white/10 hover:border-white/20 transition-colors"
                          >
                            Link Account
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: EDIT PROFILE */}
          {activeTab === 'edit' && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-3xl mx-auto"
            >
              <div className="p-6 sm:p-10 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                  <div>
                    <h2 className="text-xl font-bold text-white">Edit Profile Details</h2>
                    <p className="text-xs text-gray-400 mt-1 font-mono">Changes sync across your Bedrock instance immediately.</p>
                  </div>
                  {saveSuccess && (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Saved successfully
                    </span>
                  )}
                </div>

                <form onSubmit={handleSave} className="space-y-6 font-mono text-xs">
                  {/* Profile Photo Upload Section from PC */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                      <div className="flex items-center gap-4">
                        <div 
                          className="relative group cursor-pointer shrink-0"
                          onClick={handleAvatarClick}
                          title="Click to select photo from your PC"
                        >
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-basalt-900 via-[#162724] to-basalt-800 text-white flex items-center justify-center font-display font-bold text-2xl relative overflow-hidden border border-white/15 group-hover:border-copper-400/80 shadow-lg transition-all">
                            {effectiveAvatar ? (
                              <img 
                                src={effectiveAvatar} 
                                alt={effectiveName} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <span>{effectiveInitials}</span>
                            )}
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera className="w-5 h-5 text-copper-300" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-sans">Profile Photo</span>
                            {profile.avatarUrl ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-copper-500/20 text-copper-300 border border-copper-500/30">
                                Custom Photo Active
                              </span>
                            ) : clerkUser?.imageUrl ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                                OAuth Default
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-400 font-mono">
                            Select and upload an image from your PC folder.
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            Supports PNG, JPG, WEBP, or GIF (auto center-cropped to 400×400).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto font-mono text-xs">
                        <button
                          type="button"
                          onClick={handleAvatarClick}
                          disabled={isUploadingPhoto}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-semibold transition-all shadow-md shadow-copper-500/20 cursor-pointer disabled:opacity-50"
                        >
                          {isUploadingPhoto ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-4 h-4" />
                              <span>Choose from PC</span>
                            </>
                          )}
                        </button>

                        {profile.avatarUrl && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                            title="Revert to default photo"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleAvatarClick}
                      className={cn(
                        "p-4 rounded-xl border border-dashed transition-all cursor-pointer flex items-center justify-center gap-3 text-center",
                        isDragging
                          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                          : "bg-black/30 border-white/10 hover:border-white/20 text-gray-400 hover:text-gray-300"
                      )}
                    >
                      <UploadCloud className={cn("w-5 h-5 shrink-0", isDragging ? "text-emerald-400 animate-bounce" : "text-gray-500")} />
                      <span className="text-xs font-mono">
                        {isDragging ? "Drop your photo file here to upload" : "Or drag and drop an image file here from your computer"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-sans"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">Username Handle</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">Primary Role</label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">Organization</label>
                      <input
                        type="text"
                        value={formData.organization}
                        onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-sans"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-sans"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-gray-300">Bio & Summary</label>
                    <textarea
                      rows={3}
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 resize-none font-sans leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">GitHub Username</label>
                      <input
                        type="text"
                        value={formData.github}
                        onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-gray-300">HuggingFace Username</label>
                      <input
                        type="text"
                        value={formData.huggingface}
                        onChange={(e) => setFormData({ ...formData, huggingface: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      Reset Defaults
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider bg-copper-500 hover:bg-copper-600 text-white shadow-lg shadow-copper-500/20 transition-all disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* TAB 3: USAGE & PLAN */}
          {activeTab === 'usage' && (
            <motion.div
              key="usage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Current Active Plan */}
                <div className="md:col-span-2 p-8 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-xl space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono text-copper-400 font-bold tracking-wider uppercase">Active Subscription</span>
                      <h2 className="text-2xl font-bold text-white mt-1">Bedrock Explorer (Free Plan)</h2>
                      <p className="text-xs text-gray-400 mt-1 font-mono">Standard sandbox access for prompt engineers & builders.</p>
                    </div>
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-white/10 text-white border border-white/10">
                      ₹0 / month
                    </span>
                  </div>

                  <div className="h-px bg-white/10" />

                  {/* Quotas Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Monthly Free Tokens</span>
                      <p className="text-xl font-bold text-white">
                        {telemetry.totalTokens.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-gray-500">/ 10,000</span>
                      </p>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.round((telemetry.totalTokens / 10000) * 100))}%` }} 
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">Resets on the 1st of each month.</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Daily Pipelines Run</span>
                      <p className="text-xl font-bold text-white">
                        {telemetry.totalInferences}{' '}
                        <span className="text-xs font-normal text-gray-500">/ 20 Max</span>
                      </p>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-copper-400 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.round((telemetry.totalInferences / 20) * 100))}%` }} 
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">Pro plan supports 20 threads.</p>
                    </div>
                  </div>

                  {/* Feature Comparison */}
                  <div className="space-y-3 pt-2 font-mono">
                    <h3 className="text-xs uppercase tracking-wider text-gray-400">Included in Free Tier:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Visual Prompt Wizard</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Branching Tree (3 levels)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Prompt Library Storage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Side-by-side Dual Model Comparison</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono">
                    <Link
                      to="/app/billing"
                      className="text-xs text-copper-400 hover:text-copper-300 font-semibold uppercase tracking-wider"
                    >
                      Payment History & Receipts &rarr;
                    </Link>

                    <Link
                      to="/app/pricing"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-copper-500 hover:bg-copper-600 text-white shadow-lg shadow-copper-500/20 transition-all"
                    >
                      Upgrade to Pro
                    </Link>
                  </div>
                </div>

                {/* Pro Tier Pitch */}
                <div className="p-8 rounded-3xl border border-copper-500/30 bg-gradient-to-b from-copper-950/20 via-[#121417]/80 to-[#121417] backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden font-mono">
                  <div className="space-y-6 relative z-10">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-copper-500/20 text-copper-300 border border-copper-500/30">
                      RECOMMENDED
                    </span>

                    <div>
                      <h3 className="text-2xl font-bold font-display text-white">Bedrock Pro</h3>
                      <p className="text-3xl font-bold text-white mt-2">
                        ₹399 <span className="text-xs text-gray-400 font-normal">/ month</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-2 font-sans">Designed for high-throughput AI builders & production teams.</p>
                    </div>

                    <div className="space-y-2.5 text-xs text-gray-300">
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Unlimited Monthly Tokens</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Custom API Key Vault</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Unlimited Pipeline Depth</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-copper-400 font-bold">—</span>
                        <span>Priority Execution Concurrency</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 relative z-10">
                    <Link
                      to="/app/pricing"
                      className="w-full py-3 px-4 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-bold text-xs uppercase tracking-wider text-center shadow-xl shadow-copper-500/25 transition-all block"
                    >
                      Upgrade Instantly
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: PREFERENCES & API KEYS */}
          {activeTab === 'preferences' && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Default Model Preferences</h2>
                  <p className="text-xs text-gray-400 mt-1 font-mono">Primary foundation models for prompt synthesis and arena benchmarks.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'mistral', name: 'Mistral Large', provider: 'Mistral AI', desc: 'Superior coding, creative depth, and reasoning.' },
                    { id: 'qwen', name: 'Qwen 2.5 72B', provider: 'Alibaba Cloud / HF', desc: 'State-of-the-art open-weights reasoning and instruction following.' },
                    { id: 'gemini', name: 'Gemini 1.5 Pro', provider: 'Google', desc: 'Massive context window for deep document synthesis.' },
                    { id: 'llama', name: 'Llama 3 70B', provider: 'Meta / Groq', desc: 'Ultra-low latency inference via specialized LPUs.' },
                  ].map((m, idx) => (
                    <div
                      key={m.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative",
                        idx === 0
                          ? "bg-copper-500/10 border-copper-500/50 shadow-sm"
                          : "bg-white/[0.02] border-white/5 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-white text-sm">{m.name}</span>
                        {idx === 0 && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-copper-500 text-white uppercase">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-gray-400">{m.provider}</span>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                  <span className="text-gray-400">
                    To manage API keys (Gemini, Groq, OpenRouter), visit Settings.
                  </span>

                  <Link
                    to="/app/settings"
                    className="px-4 py-2.5 rounded-xl font-semibold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                  >
                    Open Settings
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </PageTransition>
  );
}
