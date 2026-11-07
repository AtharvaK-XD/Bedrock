import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/react';
import { User, Calendar, Compass, ArrowRight, ArrowLeft, Check, Shield, Rocket } from 'lucide-react';
import { playUiAudio } from '../../lib/appSettings';
import { useDialogBehavior } from '../../lib/useDialogBehavior';

const REFERRAL_SOURCES = [
  { id: 'twitter', label: '𝕏 / Twitter', icon: '𝕏' },
  { id: 'youtube', label: 'YouTube', icon: '▶' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'reddit', label: 'Reddit', icon: 'r/' },
  { id: 'friend', label: 'Friend or Colleague', icon: '@' },
  { id: 'search', label: 'Google / Web Search', icon: 'G' },
  { id: 'other', label: 'Other', icon: '+' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MIN_AGE_YEARS = 13;

/** The real date for these picks, or null when the day does not exist (31 February) or a part is missing. */
function buildBirthDate(year: string, month: string, day: string): { iso: string; date: Date } | null {
  const m = MONTHS.indexOf(month);
  if (!year || m < 0 || !day) return null;
  const y = Number(year);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m || date.getUTCDate() !== d) return null;
  return { iso: `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, date };
}

/** Whole years between the birth date and today, counted by the exact day. */
function ageInYears(birth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export function FirstTimeOnboardingModal() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [name, setName] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [otherReferralText, setOtherReferralText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the person finishes or skips. It stops the "should we show this?" check below from closing the window
  // early (saving to Clerk changes the user object, which would otherwise re-run that check mid-celebration).
  const finishedRef = useRef(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Pre-fill name and evaluate if user needs onboarding
  useEffect(() => {
    if (finishedRef.current) return;
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

  // Keyboard users stay inside the window (Tab cycles through its controls)
  useDialogBehavior(dialogRef, isOpen && Boolean(user));

  if (!isOpen || !user) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const monthIndex = MONTHS.indexOf(birthMonth);
  const daysInMonth =
    monthIndex >= 0 ? new Date(Date.UTC(Number(birthYear) || 2000, monthIndex + 1, 0)).getUTCDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

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

  // Returns the validated birth date, '' when the question was left empty, or null (and an error) when it is wrong
  const checkBirthDate = (): string | null => {
    const anyPicked = Boolean(birthMonth || birthDay || birthYear);
    if (!anyPicked) return '';
    const built = buildBirthDate(birthYear, birthMonth, birthDay);
    if (!built) {
      setError('Pick a real date (month, day and year), or skip this question.');
      return null;
    }
    if (built.date.getTime() > Date.now()) {
      setError("That date is in the future. Please check it, or skip this question.");
      return null;
    }
    if (ageInYears(built.date) < MIN_AGE_YEARS) {
      setError(`Bedrock is for people aged ${MIN_AGE_YEARS} and over.`);
      return null;
    }
    return built.iso;
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkBirthDate() === null) return;
    setError(null);
    playUiAudio('click');
    setStep(3);
  };

  // `skipAll` finishes straight away with only what has been answered so far (the name, if it was typed)
  const handleComplete = async (skipAll = false) => {
    const finalSource = skipAll ? '' : referralSource === 'other' ? otherReferralText.trim() || 'Other' : referralSource;
    const birthIso = skipAll ? '' : checkBirthDate();
    if (birthIso === null) {
      setStep(2);
      return;
    }
    const cleanName = name.trim();

    setError(null);
    setIsSubmitting(true);
    finishedRef.current = true;
    playUiAudio('success');

    const failures: string[] = [];

    try {
      // 1. Remember the answers in the Clerk account (only the ones that were given)
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          onboardingCompleted: true,
          ...(cleanName ? { preferredName: cleanName } : {}),
          ...(birthIso ? { birthDate: birthIso } : {}),
          ...(finalSource ? { referralSource: finalSource } : {}),
          onboardedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('Failed to save onboarding answers to the account:', err);
      failures.push('your answers');
    }

    // 2. Mark local storage so it never shows again on this device
    try {
      localStorage.setItem(`bedrock_onboarding_completed_${user.id}`, 'true');
    } catch {
      // storage blocked: the Clerk flag above still prevents a repeat
    }

    // 3. Local profile name + the Bedrock server (the extras are optional and never block the person)
    try {
      if (cleanName) {
        const stored = localStorage.getItem('bedrock_user_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.name = cleanName;
          localStorage.setItem('bedrock_user_profile', JSON.stringify(parsed));
          window.dispatchEvent(new Event('bedrock_profile_update'));
        }
      }

      const clerk = (window as any).Clerk;
      const token = clerk?.session ? await clerk.session.getToken() : null;
      if (token) {
        const send = async (body: Record<string, string>) => {
          const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        };
        if (cleanName) {
          try {
            await send({ name: cleanName });
          } catch {
            failures.push('your name');
          }
        }
        // OPEN-0067: the onboarding answers go in their own request, with nothing else in it
        const extras: Record<string, string> = {};
        if (birthIso) extras.birthDate = birthIso;
        if (finalSource) extras.referralSource = finalSource.slice(0, 100);
        if (Object.keys(extras).length > 0) {
          try {
            await send(extras);
          } catch {
            failures.push('your birth date and source');
          }
        }
      }
    } catch {
      // the name and answers are extras: nothing here may stop the person from using Bedrock
    }

    if (failures.length > 0) {
      setSaveNote(`We couldn't save ${failures.join(' and ')} right now. This does not affect your account, and you can add them later in Settings.`);
    }
    setIsSubmitting(false);
    setStep(4);
    setTimeout(() => setIsOpen(false), failures.length > 0 ? 3500 : 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-copper-500/10 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Bedrock"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg bg-zinc-950/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 overflow-hidden"
      >
        {/* Top Header Badge & Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-sandstone-300 font-mono">
            <Compass className="w-3.5 h-3.5 text-copper-400" />
            <span>Welcome to Bedrock</span>
          </div>

          {step < 4 && (
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => handleComplete(true)}
                  disabled={isSubmitting}
                  className="text-xs text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-300 hover:underline cursor-pointer disabled:opacity-50"
                >
                  Skip the rest
                </button>
              )}
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
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 text-center">
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
                  Optional. Used to confirm you meet the age requirement. You can skip this question.
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
                    onChange={(e) => {
                      setBirthMonth(e.target.value);
                      if (error) setError(null);
                      // keep the day valid for the new month (for example 31 -> 30)
                      const nextMonth = MONTHS.indexOf(e.target.value);
                      if (nextMonth >= 0 && birthDay && Number(birthDay) > new Date(Date.UTC(Number(birthYear) || 2000, nextMonth + 1, 0)).getUTCDate()) setBirthDay('');
                    }}
                    aria-label="Birth month"
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-400">Month</option>
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
                    onChange={(e) => {
                      setBirthDay(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-label="Birth day"
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-400">Day</option>
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
                    onChange={(e) => {
                      setBirthYear(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-label="Birth year"
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-400">Year</option>
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
                  Optional. It helps us see what is working. You can skip this question.
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
                  onClick={() => handleComplete(false)}
                  className="flex-1 flex items-center justify-center gap-2 bg-copper-500 hover:bg-copper-600 disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-copper-500/25 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{referralSource ? 'Launch Bedrock' : 'Skip and launch Bedrock'}</span>
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
                You're all set{name.trim() ? `, ${name.trim()}` : ''}!
              </h2>
              <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
                Your prompt engineering workstation is ready. Entering Bedrock now...
              </p>
              {saveNote && <p role="status" className="text-xs text-amber-300 max-w-sm mx-auto leading-relaxed">{saveNote}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

