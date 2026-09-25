import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RichInput } from '../components/ui/RichInput';
import { BorderBeam } from 'border-beam';
import PixelCard from '../components/ui/PixelCard';
import { generateQuestions, synthesizePrompt, getActiveApiKeys } from '../lib/api';
import type { Question, Answer, IdeaPayload } from '../lib/api';
import { openApiKeyModal } from '../lib/apiKeyEvents';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { PageTransition } from '../components/layout/PageTransition';
import { KeyRound } from 'lucide-react';
import { isDesktopApp } from '../lib/platform';

export default function Wizard() {
  const navigate = useNavigate();
  const questionsRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [idea, setIdea] = useState('');
  const [targetType, setTargetType] = useState<IdeaPayload['targetType']>('coding_agent');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const [errorBanner, setErrorBanner] = useState<{
    type: 'api_key' | 'general';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const handleKeysUpdated = () => {
      setErrorBanner(null);
    };
    window.addEventListener('bedrock_api_keys_updated', handleKeysUpdated);
    return () => window.removeEventListener('bedrock_api_keys_updated', handleKeysUpdated);
  }, []);

  const handleGenerateQuestions = async () => {
    if (!idea.trim()) return;
    setErrorBanner(null);

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

    setIsGenerating(true);
    try {
      const q = await generateQuestions({ ideaText: idea, targetType });
      setQuestions(q);
      setStep(2);
    } catch (err: any) {
      console.error('Question generation failed:', err);
      const isKeyError = Boolean(
        err?.isApiKeyError ||
        err?.message?.toLowerCase().includes('api key') ||
        err?.message?.toLowerCase().includes('api_key') ||
        err?.message?.toLowerCase().includes('unauthorized') ||
        err?.message?.toLowerCase().includes('forbidden') ||
        err?.message?.toLowerCase().includes('permission denied')
      );

      if (isKeyError) {
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
          title: 'Generation Failed',
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
    try {
      const promptText = await synthesizePrompt({ ideaText: idea, targetType }, answersArray, questions);
      navigate('/app/result', { state: { promptText, idea } });
    } catch (err: any) {
      console.error('Prompt synthesis failed:', err);
      const isKeyError = Boolean(
        err?.isApiKeyError ||
        err?.message?.toLowerCase().includes('api key') ||
        err?.message?.toLowerCase().includes('api_key')
      );
      if (isKeyError) {
        const keyMsg = err?.message || 'Unable to synthesize prompt: Your API key is invalid or missing.';
        setErrorBanner({
          type: 'api_key',
          title: 'Invalid API Key',
          message: keyMsg,
        });
        openApiKeyModal(keyMsg);
      } else {
        setErrorBanner({
          type: 'general',
          title: 'Synthesis Failed',
          message: err?.message || 'An error occurred while synthesizing prompt. Please try again.',
        });
      }
    } finally {
      setIsSynthesizing(false);
    }
  };

  const isDesktop = isDesktopApp();

  return (
    <PageTransition>
      <div className={cn("w-full px-4 sm:px-8 py-6 lg:py-10 min-h-[calc(100vh-80px)]", isDesktop ? "flex flex-col" : "")}>
      <div className={cn(
        "w-full flex flex-col gap-12 transition-all duration-500",
        isDesktop && questions.length === 0 ? "flex-1 justify-center" : ""
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

            <div className="max-w-5xl mx-auto w-full">
              <BorderBeam
                size="md"
                colorVariant="colorful"
                borderRadius={24}
                strength={1}
                className="rounded-3xl !overflow-visible relative z-30"
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
                        ? "bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-amber-500/35 shadow-[0_8px_32px_rgba(245,158,11,0.18)]"
                        : "bg-rose-500/15 border-rose-500/30 shadow-[0_8px_32px_rgba(244,63,94,0.15)]"
                    )}>
                      <div className="flex items-start gap-3.5">
                        <div className={cn(
                          "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                          errorBanner.type === 'api_key'
                            ? "bg-amber-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/20"
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
                                ? "text-amber-300 bg-amber-500/20 border-amber-500/35"
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
                        {errorBanner.type === 'api_key' && (
                          <button
                            type="button"
                            onClick={() => openApiKeyModal(errorBanner.message)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold font-display bg-gradient-to-r from-amber-500 to-copper-500 hover:from-amber-400 hover:to-copper-400 text-white shadow-md shadow-amber-500/25 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Enter API Keys</span>
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
                      {questions.map((q, idx) => (
                        <div key={q.id} className="space-y-5">
                          <Label className="text-lg font-medium text-white block flex items-start gap-4">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 font-mono flex items-center justify-center text-xs font-semibold text-gray-300">
                              0{idx + 1}
                            </span>
                            <span className="pt-1">{q.questionText}</span>
                          </Label>
                          
                          <div className="pl-12">
                            {q.questionType === 'free_text' && (
                              <Input 
                                value={answers[q.id] as string || ''}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                placeholder="Your answer..."
                                className="bg-[#111] border-white/10 text-white placeholder:text-gray-500 hover:border-white/20 focus-visible:bg-white/5 focus-visible:border-copper-500/50"
                                required
                              />
                            )}
                            {q.questionType === 'single_select' && (
                              <div className="relative">
                                <select 
                                  className="flex h-12 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 hover:border-white/20"
                                  value={answers[q.id] as string || ''}
                                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                  required
                                >
                                  <option value="" disabled className="bg-[#1a1a1a] text-white">Select an option</option>
                                  {q.options?.map(opt => (
                                    <option key={opt} value={opt} className="bg-[#1a1a1a] text-white">{opt}</option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 font-mono text-xs">
                                  ▾
                                </div>
                              </div>
                            )}
                            {q.questionType === 'multi_select' && (
                              <div className="flex flex-wrap gap-3">
                                {q.options?.map(opt => {
                                  const current = (answers[q.id] as string[]) || [];
                                  const isSelected = current.includes(opt);
                                  return (
                                    <button
                                      type="button"
                                      key={opt}
                                      onClick={() => {
                                        const next = isSelected 
                                          ? current.filter(c => c !== opt)
                                          : [...current, opt];
                                        setAnswers(prev => ({ ...prev, [q.id]: next }));
                                      }}
                                      className={cn(
                                        "px-5 py-3 text-sm rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 font-medium",
                                        isSelected 
                                          ? "bg-copper-500 border-copper-500 text-white shadow-md shadow-copper-500/20" 
                                          : "bg-[#111] border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
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
                      ))}

                      <div className="pt-8 border-t border-white/5 flex justify-end pl-12">
                        <button
                          type="submit"
                          disabled={isSynthesizing}
                          className="inline-flex items-center justify-center rounded-xl bg-white text-black hover:bg-gray-200 px-8 py-4 text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 w-full sm:w-auto active:scale-[0.98]"
                        >
                          {isSynthesizing && (
                            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-3 inline-block"></span>
                          )}
                          Synthesize Prompt
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
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
                    {isGenerating ? 'Generating Follow-Up Questions' : 'Synthesizing Build-Ready Prompt'}
                  </div>
                  <div className="mt-2.5 text-copper-400 font-mono text-xs sm:text-sm uppercase tracking-widest animate-pulse drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                    {isGenerating ? 'ANALYZING PROMPT REQUIREMENTS...' : 'ASSEMBLING FINALIZED PROMPT...'}
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
