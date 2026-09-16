import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RichInput } from '../components/ui/RichInput';
import { BorderBeam } from 'border-beam';
import PixelCard from '../components/ui/PixelCard';
import { generateQuestions, synthesizePrompt } from '../lib/api';
import type { Question, Answer, IdeaPayload } from '../lib/api';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { PageTransition } from '../components/layout/PageTransition';

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

  const handleGenerateQuestions = async () => {
    if (!idea) return;
    setIsGenerating(true);
    try {
      const q = await generateQuestions({ ideaText: idea, targetType });
      setQuestions(q);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'An error occurred while generating questions.');
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
    setIsSynthesizing(true);
    const answersArray: Answer[] = Object.entries(answers).map(([questionId, value]) => ({
      questionId, value
    }));
    try {
      const promptText = await synthesizePrompt({ ideaText: idea, targetType }, answersArray, questions);
      navigate('/app/result', { state: { promptText, idea } });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-6 lg:py-10 min-h-[calc(100vh-80px)]">
      <div className="w-full flex flex-col gap-12 transition-all duration-500">
        
        {/* Top Section (Input) */}
        <div className="w-full relative z-20 transition-all duration-500">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-12 transition-all duration-500">
              <h1 className="text-5xl md:text-6xl font-editorial font-bold text-white mb-6 tracking-tight leading-[1.1]">
                Craft the Perfect Prompt.
              </h1>
              <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-0">
                Turn a vague idea into a solid, build-ready prompt. Select your target output, type what you want, and let us refine it.
              </p>
            </div>

            <div className="max-w-5xl mx-auto w-full">
              <BorderBeam
                size="md"
                colorVariant="colorful"
                borderRadius={24}
                strength={1}
                className="rounded-3xl"
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

      {/* PixelCard Loading Overlay for Follow-up Questions and Synthesis */}
      <AnimatePresence>
        {(isGenerating || isSynthesizing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <PixelCard
              active={true}
              variant="copper"
              gap={5}
              speed={40}
              className="w-80 h-52 sm:w-96 sm:h-56 rounded-3xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.9)] bg-[#111]/95 p-6"
            >
              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 border-2 border-copper-500/30 border-t-copper-400 rounded-full animate-spin"></div>
                <div className="mt-4 text-white font-display font-medium text-base tracking-tight">
                  {isGenerating ? 'Generating Follow-Up Questions' : 'Synthesizing Build-Ready Prompt'}
                </div>
                <div className="mt-1.5 text-copper-400 font-mono text-xs uppercase tracking-wider animate-pulse">
                  {isGenerating ? 'Analyzing prompt requirements...' : 'Assembling finalized prompt...'}
                </div>
              </div>
            </PixelCard>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
