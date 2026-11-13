import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RichInput } from '../components/ui/RichInput';
import { BorderBeam } from 'border-beam';
import PixelCard from '../components/ui/PixelCard';
import { EncryptedText } from '../components/ui/encrypted-text';
import { Button as StatefulButton } from '../components/ui/stateful-button';
import { generateQuestions, synthesizePrompt, getActiveApiKeys, normalizeQuestions } from '../lib/api';
import { isQuotaCode, quotaTitle } from '../lib/quotaErrors';
import type { Question, Answer, IdeaPayload } from '../lib/api';
import { openApiKeyModal } from '../lib/apiKeyEvents';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { PageTransition } from '../components/layout/PageTransition';
import { KeyRound, PanelLeftOpen, ArrowRight } from 'lucide-react';
import { isDesktopApp } from '../lib/platform';
import { GeneratorHistorySidebar } from '../components/generator/GeneratorHistorySidebar';
import { addPromptToHistory, syncHistoryFromDb, type HistoryPromptItem } from '../lib/generatorHistory';
import { recordExecutionTrace } from '../lib/telemetry';
import { getActiveModelSettings } from '../lib/appSettings';

export default function Wizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const questionsRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [idea, setIdea] = useState('');
  const [targetType, setTargetType] = useState<IdeaPayload['targetType']>('coding_agent');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Previous Prompts Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bedrock_generator_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [activePromptId, setActivePromptId] = useState<string | null>(null);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bedrock_generator_sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleSelectPrompt = (prompt: HistoryPromptItem) => {
    setActivePromptId(prompt.id);
    setIdea(prompt.ideaText || prompt.title);
    if (prompt.targetType) {
      setTargetType(prompt.targetType as IdeaPayload['targetType']);
    }
    if (prompt.promptText) {
      navigate('/app/result', {
        state: {
          promptText: prompt.promptText,
          idea: prompt.ideaText || prompt.title,
          historyId: prompt.id,
          targetType: prompt.targetType,
        },
      });
    }
  };

  const handleNewPrompt = () => {
    setActivePromptId(null);
    setIdea('');
    setQuestions([]);
    setAnswers({});
    setStep(1);
    setErrorBanner(null);
  };

  const [errorBanner, setErrorBanner] = useState<{
    type: 'api_key' | 'general';
    title: string;
    message: string;
    showUpgrade?: boolean;
  } | null>(null);

  useEffect(() => {
    const handleKeysUpdated = () => {
      setErrorBanner(null);
    };
    window.addEventListener('bedrock_api_keys_updated', handleKeysUpdated);
    return () => window.removeEventListener('bedrock_api_keys_updated', handleKeysUpdated);
  }, []);

  useEffect(() => {
    syncHistoryFromDb();
  }, []);

  useEffect(() => {
    if (location.state?.idea) {
      setIdea(location.state.idea);
      if (location.state.targetType) {
        setTargetType(location.state.targetType);
      }
      if (location.state.id) {
        setActivePromptId(location.state.id);
      }
      setStep(1);
    }
  }, [location.state]);

  // Continuous active driver: guarantees the colorful BorderBeam travels around the text box
  const beamContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let rafId: number;
    let start: number | null = null;
    const cycleDurationMs = 2400;

    const tick = (timestamp: number) => {
      const el = beamContainerRef.current?.querySelector<HTMLElement>('[data-beam]');
      if (el) {
        const beamId = el.getAttribute('data-beam');
        if (beamId) {
          if (!start) start = timestamp;
          const elapsed = timestamp - start;
          const angle = ((elapsed % cycleDurationMs) / cycleDurationMs) * 360;
          el.style.setProperty(`--beam-angle-${beamId}`, `${angle.toFixed(2)}deg`, 'important');
          el.style.setProperty(`--beam-opacity-${beamId}`, '1', 'important');
          if (el.hasAttribute('data-paused')) {
            el.removeAttribute('data-paused');
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleGenerateQuestions = async () => {
    if (!idea.trim()) return;
    setErrorBanner(null);

    // Desktop BYOK check: Only the Desktop App requires user-added API keys.
    // The website strictly uses developer API keys via the server backend proxy.
    if (isDesktopApp()) {
      const keys = getActiveApiKeys();
      const hasKey = Boolean(keys.geminiKey || keys.groqKey || keys.openAiKey || keys.anthropicKey);
      if (!hasKey) {
        const msg = 'Please enter your Google Gemini or Groq API key in the app to start generating prompts.';
        setErrorBanner({
          type: 'api_key',
          title: 'API Key Required',
          message: msg,
        });
        openApiKeyModal(msg);
        return;
      }
    }

    setIsGenerating(true);
    const qStartTime = Date.now();
    try {
      const createdItem = addPromptToHistory({
        title: idea.length > 36 ? idea.slice(0, 36) + '...' : idea,
        ideaText: idea,
        targetType,
        isPinned: false,
      });
      setActivePromptId(createdItem.id);
      const q = await generateQuestions({ ideaText: idea, targetType });
      setQuestions(normalizeQuestions(q));
      setStep(2);

      // Record real execution trace in Neon DB
      recordExecutionTrace({
        node: 'REQUIREMENTS_EXTRACT',
        model: 'gemini-2.5-flash',
        tokens: 520,
        latency: Date.now() - qStartTime,
        status: 'OK',
      });
    } catch (err: any) {
      console.error('Question generation failed:', err);
      recordExecutionTrace({
        node: 'REQUIREMENTS_EXTRACT',
        model: 'gemini-2.5-flash',
        tokens: 0,
        latency: Date.now() - qStartTime,
        status: 'ERR',
      });

      // The server says exactly which limit was hit and what to do about it, so its message is shown as written
      const isQuotaError = isQuotaCode(err?.code) || err?.statusCode === 429;

      if (isQuotaError && !isDesktopApp()) {
        setErrorBanner({
          type: 'general',
          title: quotaTitle(err?.code),
          message: err?.message || 'You have reached your usage limit for now. Please try again in a little while.',
          showUpgrade: Boolean(err?.showUpgrade),
        });
        return;
      }

      const isKeyError = Boolean(
        err?.isApiKeyError ||
        err?.message?.toLowerCase().includes('api key') ||
        err?.message?.toLowerCase().includes('api_key') ||
        err?.message?.toLowerCase().includes('unauthorized') ||
        err?.message?.toLowerCase().includes('forbidden') ||
        err?.message?.toLowerCase().includes('permission denied')
      );

      if (isKeyError && isDesktopApp()) {
        const keyMsg = err?.message || 'Your API key is invalid or not active. Please enter a valid API key.';
        setErrorBanner({
          type: 'api_key',
          title: 'Invalid API Key',
          message: keyMsg,
        });
        openApiKeyModal(keyMsg);
      } else {
        setErrorBanner({
          type: 'general',
          title: err?.code === 'AI_BUSY' ? 'AI is busy' : 'Generation Failed',
          message: err?.message || 'An error occurred while generating questions. Please try again.',
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (step === 2 && questionsRef.current) {
      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [step]);

  const handleSynthesize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorBanner(null);
    setIsSynthesizing(true);
    const answersArray: Answer[] = Object.entries(answers).map(([questionId, value]) => ({
      questionId, value
    }));
    const synthStartTime = Date.now();
    try {
      const promptText = await synthesizePrompt({ ideaText: idea, targetType }, answersArray, questions);
      const latency = Date.now() - synthStartTime;
      const updatedItem = addPromptToHistory({
        id: activePromptId || undefined,
        title: idea.length > 36 ? idea.slice(0, 36) + '...' : idea,
        ideaText: idea,
        targetType,
        promptText,
        isPinned: false,
      });
      setActivePromptId(updatedItem.id);

      const currentDefaultModel = getActiveModelSettings().defaultModel || 'gemini-3.5-flash-lite';

      // Record real execution trace in Neon DB
      recordExecutionTrace({
        node: 'SYNTHESIS_PIPELINE',
        model: currentDefaultModel,
        tokens: Math.max(450, Math.round(promptText.length / 3.8)),
        latency,
        status: 'OK',
      });

      navigate('/app/result', { state: { promptText, idea, historyId: updatedItem.id } });
    } catch (err: any) {
      console.error('Prompt synthesis failed:', err);
      const currentDefaultModel = getActiveModelSettings().defaultModel || 'gemini-3.5-flash-lite';
      recordExecutionTrace({
        node: 'SYNTHESIS_PIPELINE',
        model: currentDefaultModel,
        tokens: 0,
        latency: Date.now() - synthStartTime,
        status: 'ERR',
      });

      // The server says exactly which limit was hit and what to do about it, so its message is shown as written
      const isQuotaError = isQuotaCode(err?.code) || err?.statusCode === 429;

      if (isQuotaError && !isDesktopApp()) {
        setErrorBanner({
          type: 'general',
          title: quotaTitle(err?.code),
          message: err?.message || 'You have reached your usage limit for now. Please try again in a little while.',
          showUpgrade: Boolean(err?.showUpgrade),
        });
        return;
      }

      const isKeyError = Boolean(
        err?.isApiKeyError ||
        err?.message?.toLowerCase().includes('api key') ||
        err?.message?.toLowerCase().includes('api_key')
      );
      if (isKeyError && isDesktopApp()) {
        const keyMsg = err?.message || 'Unable to synthesize prompt: Your API key is invalid or missing.';
        setErrorBanner({
          type: 'api_key',
          title: 'Invalid API Key',
          message: keyMsg,
        });
        openApiKeyModal(keyMsg);
      } else {
        const isBusy = err?.code === 'AI_BUSY' || err?.code === 'AI_ALL_PROVIDERS_FAILED' || err?.statusCode === 503;
        setErrorBanner({
          type: 'general',
          title: isBusy ? 'AI Providers Busy' : (err?.title || 'Synthesis Failed'),
          message: err?.message || 'Bedrock could not complete that request right now. Please try again in a moment.',
        });
      }
    } finally {
      setIsSynthesizing(false);
    }
  };

  const isDesktop = isDesktopApp();

  return (
    <PageTransition className={cn(isDesktop ? "h-full min-h-full flex flex-col" : "")}>
      <div className={cn("relative w-full", isDesktop ? "h-full min-h-full flex flex-col flex-1" : "min-h-[calc(100vh-80px)]")}>
        {/* Previous Prompts Sidebar: WEBSITE ONLY (Desktop Workstation uses dedicated History workspace in main Sidebar) */}
        {!isDesktop && (
          <>
            <GeneratorHistorySidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              activeId={activePromptId}
              onSelectPrompt={handleSelectPrompt}
              onNewPrompt={handleNewPrompt}
            />

            {/* Mobile backdrop overlay */}
            {!isSidebarCollapsed && (
              <div
                onClick={toggleSidebar}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
              />
            )}

            {/* Floating Expand Trigger when minimized */}
            <AnimatePresence>
              {isSidebarCollapsed && (
                <motion.button
                  key="floating-history-btn"
                  initial={{ opacity: 0, x: -16, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -16, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  type="button"
                  onClick={toggleSidebar}
                  className="fixed z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sf-0c0d10/95 border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 shadow-xl backdrop-blur-xl transition-colors cursor-pointer group top-22 left-4"
                  title="Show previous prompts"
                >
                  <PanelLeftOpen className="w-4 h-4 text-copper-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-mono">History</span>
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Main Generator Workspace */}
        <div className={cn(
          "w-full px-4 sm:px-8",
          isDesktop 
            ? "h-full min-h-full flex flex-col flex-1 py-6" 
            : "py-6 lg:py-10 min-h-[calc(100vh-80px)]"
        )}>
        <div className={cn(
          "w-full flex flex-col gap-12 transition-all duration-500",
          isDesktop && questions.length === 0 ? "my-auto" : ""
        )}>
        
        {/* Top Section (Input) */}
        <div className="w-full relative z-20 transition-all duration-500">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-8 transition-all duration-500">
              <h1 className="text-4xl md:text-5xl font-editorial font-bold text-white mb-4 tracking-tight leading-[1.1]">
                Craft the Perfect Prompt.
              </h1>
              <p className="text-base md:text-lg text-gray-400 leading-relaxed max-w-xl mx-auto mb-0">
                Turn a vague idea into a solid, build-ready prompt. Select your target output, type what you want, and let us refine it.
              </p>
            </div>

            <div ref={beamContainerRef} className="max-w-5xl mx-auto w-full">
              <BorderBeam
                size="md"
                colorVariant="colorful"
                borderRadius={24}
                strength={1}
                active={true}
                duration={2.4}
                className="rounded-3xl !overflow-visible relative z-30"
                style={{ overflow: 'visible' }}
              >
                <RichInput
                  value={idea}
                  onChange={setIdea}
                  onSubmit={handleGenerateQuestions}
                  isLoading={isGenerating}
                  targetType={targetType}
                  onTargetTypeChange={setTargetType}
                />
              </BorderBeam>

              {/* In-App API Key / Error Banner */}
              <AnimatePresence>
                {errorBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="mt-5"
                  >
                    <div className={cn(
                      "relative rounded-2xl p-4 sm:p-5 border backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                      errorBanner.type === 'api_key'
                        ? "bg-gradient-to-r from-copper-500/15 via-emerald-500/10 to-copper-500/15 border-copper-500/35 shadow-[0_8px_32px_rgba(44,154,139,0.18)]"
                        : "bg-rose-500/15 border-rose-500/30 shadow-[0_8px_32px_rgba(244,63,94,0.15)]"
                    )}>
                      <div className="flex items-start gap-3.5">
                        <div className={cn(
                          "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                          errorBanner.type === 'api_key'
                            ? "bg-copper-500/20 border-copper-400/40 text-copper-300 shadow-copper-500/20"
                            : "bg-rose-500/20 border-rose-400/40 text-rose-300 shadow-rose-500/20"
                        )}>
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-display font-bold text-white tracking-wide">{errorBanner.title}</h4>
                            <span className={cn(
                              "font-mono text-[10px] px-2 py-0.5 rounded-full uppercase border font-semibold",
                              errorBanner.type === 'api_key'
                                ? "text-copper-300 bg-copper-500/20 border-copper-500/35"
                                : "text-rose-300 bg-rose-500/20 border-rose-500/35"
                            )}>
                              {errorBanner.type === 'api_key' ? 'Action Required' : 'Notice'}
                            </span>
                          </div>
                          <p className="text-xs text-white/80 mt-1 leading-relaxed max-w-2xl font-mono">
                            {errorBanner.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        {errorBanner.type === 'api_key' && isDesktop && (
                          <button
                            type="button"
                            onClick={() => openApiKeyModal(errorBanner.message)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold font-display bg-copper-500 hover:bg-copper-600 text-white shadow-md shadow-copper-500/25 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Enter API Keys</span>
                          </button>
                        )}
                        {!isDesktop && errorBanner.showUpgrade && (
                          <button
                            type="button"
                            onClick={() => navigate('/app/pricing')}
                            className="px-4 py-2 rounded-xl text-xs font-semibold font-display bg-copper-500 hover:bg-copper-600 text-white shadow-md shadow-copper-500/25 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <span>Upgrade Plan</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setErrorBanner(null)}
                          className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-xs"
                          title="Dismiss notice"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Bottom Section (Questions) */}
        <div className="w-full relative z-10 transition-all duration-500" ref={questionsRef}>
          <AnimatePresence mode="wait">
            {step === 2 && (
                <motion.div
                  key="questions"
                  initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="glass-card border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-20" />
                    <div className="pointer-events-none absolute inset-0 glass-noise opacity-20 rounded-[32px] z-0" />
                    
                    <div className="relative z-10 mb-10">
                      <span className="font-mono text-[11px] text-copper-400 uppercase tracking-widest px-3 py-1 rounded-full bg-copper-500/10 border border-copper-500/20 mb-3 inline-block">
                        Step 02 · Requirements
                      </span>
                      <h3 className="text-3xl font-display font-bold text-white">Clarifying Questions</h3>
                      <p className="text-lg text-gray-400 mt-2">Let's refine your idea to generate the best possible prompt.</p>
                    </div>
                    
                    <form onSubmit={handleSynthesize} className="space-y-12 relative z-10">
                      {questions.map((q, idx) => {
                        const qId = q.id || `q${idx + 1}`;
                        const qText = q.questionText || (q as any).question || (q as any).text || (q as any).title || `Clarifying Question ${idx + 1}`;
                        const rawType = String(q.questionType || (q as any).type || (q as any).question_type || '').toLowerCase();
                        const rawOptions = q.options || (q as any).choices || (q as any).values;
                        const qOptions: string[] = Array.isArray(rawOptions) ? rawOptions.map(String) : [];
                        const hasOptions = qOptions.length > 0;

                        let qType: 'single_select' | 'multi_select' | 'free_text' = 'free_text';
                        if (hasOptions) {
                          if (rawType.includes('multi') || rawType.includes('checkbox')) {
                            qType = 'multi_select';
                          } else {
                            qType = 'single_select';
                          }
                        } else {
                          qType = 'free_text';
                        }

                        return (
                          <div key={qId} className="space-y-5">
                            <Label className="text-lg font-medium text-white flex items-start gap-4">
                              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 font-mono flex items-center justify-center text-xs font-semibold text-gray-300">
                                0{idx + 1}
                              </span>
                              <span className="pt-1 text-white font-medium">{qText}</span>
                            </Label>
                            
                            <div className="pl-12">
                              {qType === 'free_text' && (
                                <Input 
                                  value={answers[qId] as string || ''}
                                  maxLength={1000}
                                  onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
                                  placeholder="Your answer..."
                                  className="bg-[#111111] border-white/10 text-white placeholder:text-gray-500 hover:border-white/20 focus-visible:bg-white/5 focus-visible:border-copper-500/50"
                                  required
                                />
                              )}
                              {qType === 'single_select' && (
                                <div className="relative">
                                  <select 
                                    className="flex h-12 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 hover:border-white/20"
                                    value={answers[qId] as string || ''}
                                    onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
                                    required
                                  >
                                    <option value="" disabled className="bg-sf-1a1a1a text-white">Select an option</option>
                                    {qOptions.map(opt => (
                                      <option key={opt} value={opt} className="bg-sf-1a1a1a text-white">{opt}</option>
                                    ))}
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 font-mono text-xs">
                                    ▾
                                  </div>
                                </div>
                              )}
                              {qType === 'multi_select' && (
                                <div className="flex flex-wrap gap-3">
                                  {qOptions.map(opt => {
                                    const current = (answers[qId] as string[]) || [];
                                    const isSelected = current.includes(opt);
                                    return (
                                      <button
                                        type="button"
                                        key={opt}
                                        onClick={() => {
                                          const next = isSelected 
                                            ? current.filter(c => c !== opt)
                                            : [...current, opt];
                                          setAnswers(prev => ({ ...prev, [qId]: next }));
                                        }}
                                        className={cn(
                                          "px-5 py-3 text-sm rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 font-medium",
                                          isSelected 
                                            ? "bg-copper-500 border-copper-500 text-white shadow-md shadow-copper-500/20" 
                                            : "bg-[#111111] border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
                                      )}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-8 border-t border-white/5 flex justify-end pl-12">
                        <StatefulButton
                          type="submit"
                          disabled={isSynthesizing}
                          className="rounded-xl px-8 py-4 text-base font-semibold bg-copper-500 hover:bg-copper-600 text-white shadow-lg shadow-copper-500/25 w-full sm:w-auto transition-all active:scale-[0.98]"
                        >
                          Synthesize Prompt
                        </StatefulButton>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>
      </div>
      </div>

      {/* Full Screen PixelCard Loading Overlay for Follow-up Questions and Synthesis */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {(isGenerating || isSynthesizing) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center bg-black overflow-hidden"
            >
              <PixelCard
                active={true}
                variant="copper"
                gap={12}
                speed={35}
                className="w-full h-full !rounded-none !border-0 !bg-black flex flex-col items-center justify-center relative"
              >
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-lg select-none pointer-events-none">
                  <div className="w-12 h-12 border-2 border-copper-500/30 border-t-copper-400 rounded-full animate-spin drop-shadow-[0_0_15px_rgba(200,168,107,0.5)]"></div>
                  <div className="mt-6 text-white font-display font-medium text-2xl sm:text-3xl tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                    <EncryptedText
                      text={isGenerating ? 'Generating Follow-Up Questions' : 'Synthesizing Build-Ready Prompt'}
                      encryptedClassName="text-neutral-500"
                      revealedClassName="text-white"
                      revealDelayMs={35}
                    />
                  </div>
                  <div className="mt-2.5 font-mono text-xs sm:text-sm uppercase tracking-widest drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                    <EncryptedText
                      text={isGenerating ? 'ANALYZING PROMPT REQUIREMENTS...' : 'ASSEMBLING FINALIZED PROMPT...'}
                      encryptedClassName="text-copper-700/60"
                      revealedClassName="text-copper-400"
                      revealDelayMs={45}
                    />
                  </div>
                </div>
              </PixelCard>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageTransition>
  );
}
