import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/react';
import { User, Calendar, Compass, ArrowRight, ArrowLeft, Check, Sparkles, Shield, Rocket } from 'lucide-react';
import { playUiAudio } from '../../lib/appSettings';

const REFERRAL_SOURCES = [
  { id: 'twitter', label: '𝕏 / Twitter', icon: '𝕏' },
  { id: 'youtube', label: 'YouTube', icon: '▶' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'reddit', label: 'Reddit', icon: '👾' },
  { id: 'friend', label: 'Friend or Colleague', icon: '🤝' },
  { id: 'search', label: 'Google / Web Search', icon: '🔍' },
  { id: 'other', label: 'Other', icon: '✨' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function FirstTimeOnboardingModal() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [name, setName] = useState('');
  const [birthMonth, setBirthMonth] = useState('January');
  const [birthDay, setBirthDay] = useState('1');
  const [birthYear, setBirthYear] = useState('2000');
  const [referralSource, setReferralSource] = useState('');
  const [otherReferralText, setOtherReferralText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill name and evaluate if user needs onboarding
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const metadata = (user.unsafeMetadata || {}) as Record<string, any>;
    const localFlag = localStorage.getItem(`bedrock_onboarding_completed_${user.id}`);

    // If already completed in Clerk cloud metadata or local storage, strictly DO NOT show
    if (metadata.onboardingCompleted === true || localFlag === 'true') {
      setIsOpen(false);
      return;
    }

    // Determine initial pre-filled name from Clerk
    const initialName = user.firstName || user.fullName || user.username || '';
    if (initialName && !initialName.startsWith('user_')) {
      setName(initialName);
    }

    setIsOpen(true);
  }, [isLoaded, isSignedIn, user]);

  if (!isOpen || !user) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 90 }, (_, i) => currentYear - 13 - i);
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter what we should call you.');
      return;
    }
    setError(null);
    playUiAudio('click');
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    playUiAudio('click');
    setStep(3);
  };

  const handleComplete = async () => {
    const finalSource = referralSource === 'other' ? (otherReferralText.trim() || 'Other') : referralSource;
    if (!finalSource) {
      setError('Please select how you heard about Bedrock.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    playUiAudio('success');

    const formattedBirthDate = `${birthYear}-${String(MONTHS.indexOf(birthMonth) + 1).padStart(2, '0')}-${birthDay.padStart(2, '0')}`;

    try {
      // 1. Permanently update Clerk User unsafeMetadata
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          onboardingCompleted: true,
          preferredName: name.trim(),
          birthDate: formattedBirthDate,
          referralSource: finalSource,
          onboardedAt: new Date().toISOString(),
        },
      });

      // 2. Mark local storage flag so it never shows again across tabs/reloads
      localStorage.setItem(`bedrock_onboarding_completed_${user.id}`, 'true');

      // 3. Update Bedrock's profile name in local storage & dispatch sync
      try {
        const stored = localStorage.getItem('bedrock_user_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.name = name.trim();
          localStorage.setItem('bedrock_user_profile', JSON.stringify(parsed));
          window.dispatchEvent(new Event('bedrock_profile_update'));
        }

        // Try pushing name update to Neon DB via profile endpoint
        const clerk = (window as any).Clerk;
        if (clerk?.session) {
          const token = await clerk.session.getToken();
          if (token) {
            fetch('/api/user/profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ name: name.trim() }),
            }).catch(() => {});

            // Call dedicated onboarding profile update per OPEN-0067
            fetch('/api/user/profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                birthDate: formattedBirthDate,
                referralSource: finalSource,
              }),
            }).catch(() => {});
          }
        }
      } catch {}

      // 4. Move to step 4 (Welcome celebration)
      setStep(4);
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error('Failed to complete onboarding metadata save:', err);
      // Fallback: still save locally so user is never stuck
      localStorage.setItem(`bedrock_onboarding_completed_${user.id}`, 'true');
      setStep(4);
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-copper-500/10 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg bg-zinc-950/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 overflow-hidden"
      >
        {/* Top Header Badge & Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-sandstone-300 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-copper-400" />
            <span>Welcome to Bedrock</span>
          </div>

          {step < 4 && (
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? 'w-6 bg-copper-500'
                      : s < step
                      ? 'w-2 bg-emerald-500'
                      : 'w-2 bg-white/10'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: What should we call you? */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleNextStep1}
              className="space-y-6"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-copper-500/10 border border-copper-500/20 flex items-center justify-center text-copper-400 mb-4 shadow-lg shadow-copper-500/10">
                  <User className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                  What should we call you?
                </h2>
                <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">
                  Your preferred name or handle for your Bedrock prompt engineering workstation.
                </p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Atharva, Alex, Neo"
                  maxLength={50}
                  autoFocus
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-copper-500 focus:ring-1 focus:ring-copper-500/40 rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 text-base outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-copper-500 hover:bg-copper-600 text-white rounded-xl py-3.5 font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-copper-500/20 active:scale-[0.98]"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.form>
          )}

          {/* STEP 2: When were you born? */}
          {step === 2 && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleNextStep2}
              className="space-y-6"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                  When were you born?
                </h2>
                <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">
                  Helps us personalize your account milestones and ensure safety compliance.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {/* Month Selector */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                    Month
                  </label>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day Selector */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                    Day
                  </label>
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                  >
                    {days.map((d) => (
                      <option key={d} value={d} className="bg-zinc-900 text-white">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year Selector */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                    Year
                  </label>
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                  >
                    {years.map((y) => (
                      <option key={y} value={String(y)} className="bg-zinc-900 text-white">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                <Shield className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Your birth date is strictly private and never displayed publicly.</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playUiAudio('click');
                    setStep(1);
                  }}
                  className="px-4 py-3.5 rounded-xl border border-white/10 hover:bg-white/[0.04] text-zinc-300 font-medium text-sm transition-all cursor-pointer flex items-center justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3.5 font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP 3: Where did you hear about Bedrock? */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
                  <Compass className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                  Where did you hear about us?
                </h2>
                <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">
                  Help our founding team know how you discovered Bedrock.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {REFERRAL_SOURCES.map((source) => {
                  const isSelected = referralSource === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => {
                        setReferralSource(source.id);
                        if (error) setError(null);
                        playUiAudio('click');
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-copper-500/15 border-copper-500 text-white ring-1 ring-copper-500/30'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] text-zinc-300'
                      }`}
                    >
                      <span className="text-sm font-mono opacity-80">{source.icon}</span>
                      <span className="text-xs font-medium truncate">{source.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 ml-auto text-copper-400" />}
                    </button>
                  );
                })}
              </div>

              {referralSource === 'other' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pt-1"
                >
                  <input
                    type="text"
                    value={otherReferralText}
                    onChange={(e) => setOtherReferralText(e.target.value)}
                    placeholder="Tell us where you found us..."
                    maxLength={100}
                    className="w-full bg-white/[0.03] border border-white/10 focus:border-copper-500 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 text-xs outline-none"
                  />
                </motion.div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playUiAudio('click');
                    setStep(2);
                  }}
                  className="px-4 py-3.5 rounded-xl border border-white/10 hover:bg-white/[0.04] text-zinc-300 font-medium text-sm transition-all cursor-pointer flex items-center justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleComplete}
                  className="flex-1 flex items-center justify-center gap-2 bg-copper-500 hover:bg-copper-600 disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-copper-500/25 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Launch Bedrock</span>
                      <Rocket className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Celebration & Welcome */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-copper-500 to-emerald-500 p-0.5 mx-auto shadow-2xl shadow-copper-500/30">
                <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center text-emerald-400">
                  <Check className="w-8 h-8" />
                </div>
              </div>
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                You're all set, {name}!
              </h2>
              <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
                Your prompt engineering workstation is ready. Entering Bedrock now...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

