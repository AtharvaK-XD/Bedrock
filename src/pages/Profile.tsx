import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  User, 
  Sparkles, 
  Settings, 
  Check, 
  Copy, 
  ShieldCheck, 
  CreditCard, 
  Terminal, 
  Cpu, 
  GitBranch, 
  Activity, 
  Zap, 
  Clock, 
  Database,
  CheckCircle2,
  Calendar,
  Building,
  MapPin,
  Mail,
  Award,
  ArrowUpRight,
  Sliders,
  Camera,
  Globe,
  Palette,
  Share2,
  TrendingUp
} from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { useUserProfile } from '../lib/useUserProfile';
import { PromptActivityHeatmap } from '../components/profile/PromptActivityHeatmap';

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

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
  'Claude 3.5 & GPT-4o',
  'DSPy Pipelines',
  'Adaptive Routing',
];

type Tab = 'overview' | 'edit' | 'usage' | 'preferences';

const RECENT_ACTIVITY = [
  {
    id: 'ACT-01',
    title: 'Customer Support Triaging Prompt',
    type: 'Wizard Pipeline',
    model: 'claude-3.5-sonnet',
    date: '12 minutes ago',
    status: 'Optimized (98% Score)',
    path: '/app/generator',
  },
  {
    id: 'ACT-02',
    title: 'SQL Code Synthesis & Fallback Branch',
    type: 'Branching Tree',
    model: 'gpt-4o',
    date: '2 hours ago',
    status: '3 Active Nodes',
    path: '/app/branching',
  },
  {
    id: 'ACT-03',
    title: 'Financial Document Extractor Benchmark',
    type: 'Prompt Tester',
    model: 'gpt-4o vs claude-3.5',
    date: 'Yesterday',
    status: 'Evaluated 50 runs',
    path: '/app/tester',
  },
  {
    id: 'ACT-04',
    title: 'Multi-turn Technical Explainer',
    type: 'Library Template',
    model: 'llama-3-70b',
    date: '3 days ago',
    status: 'Saved to Library',
    path: '/app/library',
  },
];

export default function Profile() {
  const { profile, updateProfile, resetProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [bannerTheme, setBannerTheme] = useState('copper');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: profile.name,
    username: profile.username,
    email: profile.email,
    role: profile.role,
    bio: profile.bio,
    organization: profile.organization,
    location: profile.location,
    website: profile.website,
    github: profile.github,
    huggingface: profile.huggingface,
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(profile.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const activeTheme = BANNER_THEMES.find((t) => t.id === bannerTheme) || BANNER_THEMES[0];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateProfile(formData);
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }, 500);
  };

  const handleReset = () => {
    resetProfile();
    setFormData({
      name: 'Atharva K.',
      username: 'atharvak',
      email: 'atharva@example.com',
      role: 'Lead Prompt Architect',
      bio: 'Architecting multi-model agentic pipelines and system prompt evaluation trees on Bedrock.',
      organization: 'Bedrock Labs',
      location: 'San Francisco, CA (UTC-7)',
      website: 'https://bedrock.ai',
      github: 'atharva-k',
      huggingface: 'atharvak',
    });
  };

  return (
    <PageTransition>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 lg:py-12">
        
        {/* Top Breadcrumb & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/app" className="hover:text-white transition-colors">App</Link>
            <span>/</span>
            <span className="text-white font-medium">User Profile</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-copper-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copied' : 'Share Profile'}
            </button>
            <Link 
              to="/app/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
          </div>
        </div>

        {/* Hero Identity Banner */}
        <div className="relative rounded-3xl border border-white/10 bg-[#121417]/85 backdrop-blur-2xl overflow-hidden shadow-2xl mb-8 group/card transition-all duration-300">
          {/* Banner Graphic Background with Mesh, Neural Prompt Lines & Theme Gradients */}
          <div className={cn(
            "h-48 sm:h-56 w-full relative overflow-hidden bg-gradient-to-r border-b border-white/5 transition-all duration-500",
            activeTheme.gradient
          )}>
            <div className={cn("absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] pointer-events-none transition-all duration-500", activeTheme.radial1)} />
            <div className={cn("absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_var(--tw-gradient-stops))] pointer-events-none transition-all duration-500", activeTheme.radial2)} />
            
            {/* Tech grid mesh */}
            <div 
              className={cn("absolute inset-0 pointer-events-none transition-opacity duration-300", activeTheme.meshOpacity)} 
              style={{
                backgroundImage: `linear-gradient(to right, ${activeTheme.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${activeTheme.gridColor} 1px, transparent 1px)`,
                backgroundSize: '36px 36px'
              }}
            />

            {/* Neural Prompt Graph decorative curves */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M -50 140 C 120 40, 260 180, 440 90 C 620 0, 800 150, 980 60 C 1140 -20, 1300 110, 1480 50" fill="none" stroke={activeTheme.gridColor} strokeWidth="1.5" strokeDasharray="6 6" />
              <path d="M 60 200 C 220 110, 420 220, 640 100 C 860 -10, 1060 160, 1260 80" fill="none" stroke={activeTheme.gridColor} strokeWidth="1" opacity="0.5" />
              <circle cx="440" cy="90" r="3.5" fill={activeTheme.gridColor} />
              <circle cx="980" cy="60" r="4" fill="#ffffff" opacity="0.8" />
              <circle cx="640" cy="100" r="3" fill={activeTheme.gridColor} />
            </svg>

            {/* Subtle Telemetry Watermark */}
            <div className="absolute bottom-3 right-6 hidden md:flex items-center gap-2 text-[10px] font-mono text-white/20 tracking-widest uppercase select-none pointer-events-none">
              <span>// BEDROCK PROMPT RUNTIME v2.5</span>
              <span>•</span>
              <span>NODE: #BDRK-8924</span>
            </div>

            {/* Quick Badges & Controls in Banner */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2.5 z-20">
              {/* Theme Customizer Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white border border-white/15 backdrop-blur-md shadow-sm transition-all cursor-pointer"
                  title="Customize banner backdrop theme"
                >
                  <Palette className="w-3.5 h-3.5 text-copper-400" />
                  <span className="hidden sm:inline">Theme</span>
                </button>

                {showThemePicker && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#15181b]/95 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl z-30 space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 px-2.5 py-1">Banner Style</p>
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
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/60 backdrop-blur-md shadow-sm border transition-all",
                activeTheme.accentColor,
                activeTheme.badgeBorder
              )}>
                <span className={cn("w-2 h-2 rounded-full animate-pulse", activeTheme.dotBg)} />
                Bedrock Member
              </span>
            </div>
          </div>

          {/* Profile Header Content */}
          <div className="px-6 sm:px-10 pb-7 pt-0 relative">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16 sm:-mt-20 mb-6">
              
              {/* Avatar & Main Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-6 flex-1 min-w-0">
                
                {/* Avatar with Glow Ring & Edit Overlay */}
                <div 
                  className="relative group cursor-pointer shrink-0" 
                  onClick={() => setActiveTab('edit')}
                  title="Click to edit profile & avatar"
                >
                  <div className="relative p-1 rounded-3xl bg-gradient-to-tr from-copper-400 via-copper-500 to-emerald-400 shadow-2xl shadow-copper-900/40 ring-4 ring-[#121417]">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[22px] bg-gradient-to-tr from-basalt-900 via-[#162724] to-basalt-800 text-white flex flex-col items-center justify-center font-display font-bold text-3xl sm:text-4xl relative overflow-hidden border border-white/10 group-hover:border-copper-400/60 transition-all">
                      {/* Subtle shine glass effect */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-copper-500/20 via-transparent to-white/10 pointer-events-none" />
                      <span className="bg-gradient-to-br from-white via-sandstone-100 to-copper-200 bg-clip-text text-transparent drop-shadow-md">
                        {profile.avatarInitials}
                      </span>
                      
                      {/* Hover edit badge overlay */}
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Camera className="w-5 h-5 text-copper-300 mb-1" />
                        <span className="text-[10px] font-medium text-white/90">Edit Photo</span>
                      </div>
                    </div>
                  </div>

                  {/* Presence Status Radar Dot */}
                  <div 
                    className="absolute -bottom-1 -right-1 flex items-center justify-center"
                    title="Node Active • Online"
                  >
                    <span className="absolute w-5 h-5 rounded-full bg-emerald-400/40 animate-ping pointer-events-none" />
                    <div className="relative w-6 h-6 rounded-full bg-[#121417] p-1 shadow-md">
                      <div className="w-full h-full rounded-full bg-emerald-500 ring-2 ring-emerald-400/50 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Identity & Metadata Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-2">
                      {profile.name}
                      <span className="inline-flex items-center text-copper-400" title="Verified Prompt Architect">
                        <CheckCircle2 className="w-5 h-5 fill-copper-500/20 text-copper-400" />
                      </span>
                    </h1>

                    {/* Interactive Handle Copy */}
                    <button
                      onClick={handleCopyHandle}
                      className="group/handle inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                      title="Click to copy username handle"
                    >
                      <span>@{profile.username}</span>
                      {copiedHandle ? (
                        <Check className="w-3 h-3 text-copper-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-500 group-hover/handle:text-gray-300 transition-colors" />
                      )}
                    </button>

                    {/* Plan Badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-copper-500/15 text-copper-300 border border-copper-500/30 shadow-sm">
                      <Sparkles className="w-3 h-3 text-copper-400" />
                      {profile.plan}
                    </span>
                  </div>

                  {/* Role & Company */}
                  <p className="text-sm sm:text-base text-gray-300 font-medium flex flex-wrap items-center gap-2">
                    <span className="text-white font-semibold">{profile.role}</span>
                    <span className="text-gray-500">at</span>
                    <span className="flex items-center gap-1 text-gray-300 font-medium">
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      {profile.organization}
                    </span>
                  </p>

                  {/* Metadata Row: Location, Joined, Email & Dev Links */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400 pt-1">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <MapPin className="w-3.5 h-3.5 text-copper-400" />
                      {profile.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      Joined {profile.joinedDate}
                    </span>
                    <button 
                      onClick={handleCopyEmail}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group/email"
                      title="Click to copy email"
                    >
                      <Mail className="w-3.5 h-3.5 text-gray-500 group-hover/email:text-copper-400 transition-colors" />
                      <span className="font-mono text-[11px]">{profile.email}</span>
                      {copiedEmail && <span className="text-copper-400 font-semibold text-[11px]">(copied)</span>}
                    </button>

                    {/* Developer Social Links */}
                    {profile.github && (
                      <a 
                        href={`https://github.com/${profile.github}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors hover:underline"
                        title="GitHub Profile"
                      >
                        <GithubIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-mono text-[11px]">gh/{profile.github}</span>
                        <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                    {profile.website && (
                      <a 
                        href={profile.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-gray-400 hover:text-copper-300 transition-colors hover:underline"
                        title="Portfolio / Website"
                      >
                        <Globe className="w-3.5 h-3.5 text-copper-400" />
                        <span className="font-mono text-[11px]">{profile.website.replace(/^https?:\/\//, '')}</span>
                        <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 self-start md:self-end shrink-0">
                <button
                  onClick={() => setActiveTab(activeTab === 'edit' ? 'overview' : 'edit')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border cursor-pointer",
                    activeTab === 'edit'
                      ? "bg-white text-black hover:bg-gray-200 border-white shadow-lg"
                      : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20 hover:shadow-md"
                  )}
                >
                  <User className="w-4 h-4 text-copper-400" />
                  {activeTab === 'edit' ? 'Close Edit' : 'Edit Profile'}
                </button>

                <Link
                  to="/app/pricing"
                  className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden shadow-lg shadow-copper-500/20 hover:shadow-copper-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-copper-600 via-copper-500 to-emerald-600 group-hover:opacity-90 transition-opacity" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Sparkles className="w-4 h-4 relative z-10 animate-pulse text-white" />
                  <span className="relative z-10 font-bold">Upgrade Plan</span>
                </Link>
              </div>
            </div>

            {/* Bio summary & Specialization Tags */}
            <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
              <div className="relative pl-3.5 border-l-2 border-copper-400/80 py-0.5 bg-gradient-to-r from-copper-500/5 to-transparent rounded-r-xl">
                <p className="text-sm text-gray-200 leading-relaxed font-normal italic">
                  "{profile.bio}"
                </p>
              </div>

              {/* Specialization Tags */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 flex items-center gap-1 mr-1">
                  <Sliders className="w-3 h-3 text-copper-400" />
                  Focus:
                </span>
                {SPECIALIZATION_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.04] hover:bg-copper-500/10 text-gray-300 hover:text-copper-300 border border-white/5 hover:border-copper-500/30 transition-colors cursor-default"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar - Telemetry HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-white/10 bg-black/40 backdrop-blur-md divide-y sm:divide-y-0 sm:divide-x divide-white/5">
            {/* Stat 1: Prompts Built */}
            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-copper-400/0 group-hover:bg-copper-400 transition-colors" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <Terminal className="w-3.5 h-3.5 text-copper-400" />
                  Prompts Built
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-copper-500/10 text-copper-300 border border-copper-500/20">
                  <TrendingUp className="w-2.5 h-2.5" />
                  +18 mo
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight group-hover:text-copper-300 transition-colors">
                  142
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-copper-400 inline-block" />
                42 active in production
              </p>
            </div>

            {/* Stat 2: Branch Runs */}
            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-400/0 group-hover:bg-sky-400 transition-colors" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                  Branch Runs
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  Top 5%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight group-hover:text-sky-300 transition-colors">
                  1,894
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                3.2 avg tree depth
              </p>
            </div>

            {/* Stat 3: Tokens Used */}
            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-400/0 group-hover:bg-amber-400 transition-colors" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Tokens Used
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  84% quota
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  4.2M
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Across 3 LLM providers
              </p>
            </div>

            {/* Stat 4: Reliability */}
            <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-400/0 group-hover:bg-emerald-400 transition-colors" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Reliability
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Optimal SLA
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight group-hover:text-emerald-300 transition-colors">
                  99.4%
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Zero unhandled timeouts
              </p>
            </div>

            {/* Stat 5: Avg Latency */}
            <div className="p-4 sm:p-5 col-span-2 sm:col-span-1 hover:bg-white/[0.03] transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-400/0 group-hover:bg-indigo-400 transition-colors" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Avg Latency
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  p95: 580ms
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                  412ms
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                Fast routing engine
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Activity', icon: Activity },
            { id: 'edit', label: 'Edit Profile Info', icon: User },
            { id: 'usage', label: 'Plan & Resource Quota', icon: CreditCard },
            { id: 'preferences', label: 'Model Preferences & Keys', icon: Sliders },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-white text-black shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <tab.icon className={cn("w-4 h-4", isActive ? "text-copper-600" : "")} />
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left 2 Cols: Activity Heatmap & Recent Pipeline Executions */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Prompt Engineering Activity Heatmap */}
                  <PromptActivityHeatmap />

                  {/* Recent Prompt & Pipeline Executions */}
                  <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-copper-400" />
                        Recent Pipeline & Prompt Runs
                      </h2>
                      <Link to="/app/library" className="text-xs font-semibold text-copper-400 hover:text-copper-300 flex items-center gap-1">
                        View All in Library <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {RECENT_ACTIVITY.map((act) => (
                        <Link
                          key={act.id}
                          to={act.path}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white group-hover:text-copper-300 transition-colors text-sm">
                                {act.title}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                                {act.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                              <span>Model: {act.model}</span>
                              <span>•</span>
                              <span>{act.date}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                              {act.status}
                            </span>
                            <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Model Allocation & Quota Widget */}
                <div className="space-y-8">
                  {/* Model Distribution Card */}
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                      <Cpu className="w-4 h-4 text-copper-400" />
                      Model Utilization
                    </h2>
                    <p className="text-xs text-gray-400 mb-6">Execution share across integrated LLMs</p>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-white font-medium">GPT-4o (OpenAI)</span>
                          <span className="text-copper-400 font-bold">52%</span>
                        </div>
                        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-copper-600 to-copper-400 rounded-full" style={{ width: '52%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-white font-medium">Claude 3.5 Sonnet</span>
                          <span className="text-amber-400 font-bold">34%</span>
                        </div>
                        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style={{ width: '34%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-white font-medium">Llama 3 70B (Groq)</span>
                          <span className="text-sky-400 font-bold">14%</span>
                        </div>
                        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full" style={{ width: '14%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Preferred Routing:</span>
                      <span className="font-semibold text-white">Dynamic Latency-Optimized</span>
                    </div>
                  </div>

                  {/* Monthly Resource Quota Widget */}
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-copper-400" />
                        Plan Resource Usage
                      </h2>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-gray-300">
                        {profile.plan}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400">Monthly Free Tokens</span>
                          <span className="font-mono text-white font-semibold">8,420 / 10,000 (84%)</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: '84%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400">Daily Runs Quota</span>
                          <span className="font-mono text-white font-semibold">14 / 20 used</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-copper-500 rounded-full" style={{ width: '70%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400">Branching Max Depth</span>
                          <span className="font-mono text-white font-semibold">3 Levels (Pro: Unlimited)</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-2.5">
                      <Link
                        to="/app/pricing"
                        className="w-full py-2.5 px-4 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-semibold text-xs text-center shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Unlock Unlimited with Pro
                      </Link>
                      <Link
                        to="/app/billing"
                        className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium text-xs text-center border border-white/10 transition-colors"
                      >
                        View Invoices & Billing
                      </Link>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="p-6 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm">
                    <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                      <Award className="w-4 h-4 text-copper-400" />
                      Connected Integrations
                    </h2>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-3">
                          <GithubIcon className="w-5 h-5 text-white" />
                          <div>
                            <p className="text-xs font-semibold text-white">GitHub</p>
                            <p className="text-[10px] text-gray-400 font-mono">@{profile.github}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/40 rounded border border-emerald-800/40">
                          Connected
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-3">
                          <Terminal className="w-5 h-5 text-amber-400" />
                          <div>
                            <p className="text-xs font-semibold text-white">HuggingFace</p>
                            <p className="text-[10px] text-gray-400 font-mono">@{profile.huggingface}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/40 rounded border border-emerald-800/40">
                          Connected
                        </span>
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="max-w-3xl mx-auto"
            >
              <div className="p-6 sm:p-10 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                  <div>
                    <h2 className="text-xl font-bold text-white">Edit Profile Details</h2>
                    <p className="text-xs text-gray-400 mt-1">Changes are synced across your Bedrock interface instantly.</p>
                  </div>
                  {saveSuccess && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully
                    </span>
                  )}
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Username Handle</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-500 text-sm">@</span>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          required
                          className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Primary Role / Title</label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Organization / Team</label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                        <input
                          type="text"
                          value={formData.organization}
                          onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Location / Timezone</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Bio & Headline</label>
                    <textarea
                      rows={3}
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all resize-none leading-relaxed"
                    />
                    <p className="text-[11px] text-gray-500">Brief summary displayed on your public prompt engineering profile.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">GitHub Username</label>
                      <input
                        type="text"
                        value={formData.github}
                        onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">HuggingFace Username</label>
                      <input
                        type="text"
                        value={formData.huggingface}
                        onChange={(e) => setFormData({ ...formData, huggingface: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                    >
                      Reset to Default
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-copper-500 hover:bg-copper-600 text-white shadow-lg shadow-copper-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" /> Save Changes
                          </>
                        )}
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
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
                      <p className="text-xs text-gray-400 mt-1">Standard sandbox access for prompt engineers & builders.</p>
                    </div>
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/10">
                      ₹0 / month
                    </span>
                  </div>

                  <div className="h-px bg-white/10" />

                  {/* Quotas Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                      <span className="text-xs text-gray-400">Tokens Remaining this Month</span>
                      <p className="text-xl font-bold font-mono text-white">1,580 <span className="text-xs font-normal text-gray-500">/ 10,000</span></p>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '84%' }} />
                      </div>
                      <p className="text-[11px] text-gray-500">Resets on the 1st of each month.</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                      <span className="text-xs text-gray-400">Concurrent Pipelines</span>
                      <p className="text-xl font-bold font-mono text-white">1 Active <span className="text-xs font-normal text-gray-500">/ 2 Max</span></p>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-copper-400 rounded-full" style={{ width: '50%' }} />
                      </div>
                      <p className="text-[11px] text-gray-500">Pro plan supports 20 simultaneous threads.</p>
                    </div>
                  </div>

                  {/* Feature Comparison */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-sm font-bold text-white">Included in your Free Plan:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Visual Multi-step Prompt Wizard</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Interactive Branching Tree (up to 3 levels)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Prompt Library Template Storage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Side-by-side Dual Model Comparison</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <Link
                      to="/app/billing"
                      className="text-xs text-copper-400 hover:text-copper-300 font-semibold flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> View Payment History & Receipts
                    </Link>

                    <Link
                      to="/app/pricing"
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-copper-500 hover:bg-copper-600 text-white shadow-lg shadow-copper-500/20 transition-all flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" /> Upgrade to Pro
                    </Link>
                  </div>
                </div>

                {/* Pro Tier Pitch */}
                <div className="p-8 rounded-3xl border border-copper-500/30 bg-gradient-to-b from-copper-950/20 via-[#121417]/80 to-[#121417] backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-copper-500/10 blur-2xl pointer-events-none rounded-full" />

                  <div className="space-y-6 relative z-10">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-copper-500/20 text-copper-300 border border-copper-500/30">
                      RECOMMENDED
                    </span>

                    <div>
                      <h3 className="text-2xl font-bold font-display text-white">Bedrock Pro</h3>
                      <p className="text-3xl font-mono font-bold text-white mt-2">
                        ₹399 <span className="text-xs font-sans text-gray-400 font-normal">/ month</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-2">Designed for high-throughput AI builders & automated production pipelines.</p>
                    </div>

                    <div className="space-y-2.5 text-xs text-gray-300">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-copper-400 shrink-0" />
                        <span>Unlimited Monthly Tokens</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-copper-400 shrink-0" />
                        <span>Direct Custom API Key Vault</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-copper-400 shrink-0" />
                        <span>Unlimited Branching Pipeline Depth</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-copper-400 shrink-0" />
                        <span>Priority 20-thread Execution Concurrency</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 relative z-10">
                    <Link
                      to="/app/pricing"
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white font-semibold text-sm text-center shadow-xl shadow-copper-500/25 transition-all block"
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="p-6 sm:p-8 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Default Model Routing Preferences</h2>
                  <p className="text-xs text-gray-400 mt-1">Configure your primary foundation models for new wizard sessions and prompt runs.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'claude', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', desc: 'Superior coding, creative depth, and reasoning.' },
                    { id: 'gpt4o', name: 'GPT-4o Omnimodal', provider: 'OpenAI', desc: 'Fast throughput, tool execution, and multimodal vision.' },
                    { id: 'gemini', name: 'Gemini 1.5 Pro', provider: 'Google', desc: 'Massive 1M+ context window for deep document synthesis.' },
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
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-copper-500 text-white">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-gray-400">{m.provider}</span>
                      <p className="text-xs text-gray-400 mt-2">{m.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="w-4 h-4 text-copper-400" />
                    <span>To configure customized provider API keys (OpenAI, Anthropic, Gemini, Groq), visit Settings.</span>
                  </div>

                  <Link
                    to="/app/settings"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Open Full Settings
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
