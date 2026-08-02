import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { RichInput } from '../components/ui/RichInput';
import { PromptSuggestions } from '../components/workspace/PromptSuggestions';
import { mockGenerateQuestions, mockSynthesizePrompt } from '../lib/mockApi';
import type { Question, Answer, IdeaPayload } from '../lib/mockApi';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';

export default function Wizard() {
  const navigate = useNavigate();
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
      const q = await mockGenerateQuestions({ ideaText: idea, targetType });
      setQuestions(q);
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSynthesize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSynthesizing(true);
    const answersArray: Answer[] = Object.entries(answers).map(([questionId, value]) => ({
      questionId, value
    }));
    try {
      const promptText = await mockSynthesizePrompt({ ideaText: idea, targetType }, answersArray, questions);
      navigate('/app/result', { state: { promptText } });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 lg:py-20 min-h-[calc(100vh-80px)]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
        
        {/* Left Column (Sticky) */}
        <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-32 relative z-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold text-basalt-900 mb-4 tracking-tight leading-[1.1]">
              Craft the Perfect Prompt.
            </h1>
            <p className="text-lg text-basalt-600 mb-10 leading-relaxed max-w-md">
              Turn a vague idea into a solid, build-ready prompt. Select your target output, type what you want, and let us refine it.
            </p>

            <RichInput
              value={idea}
              onChange={setIdea}
              onSubmit={handleGenerateQuestions}
              isLoading={isGenerating}
              targetType={targetType}
              onTargetTypeChange={setTargetType}
            />
          </motion.div>
        </div>

        {/* Right Column (Scrollable Context) */}
        <div className="lg:col-span-7 xl:col-span-7 relative z-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="suggestions"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="lg:pt-4"
              >
                <div className="bg-basalt-900/5 rounded-3xl p-8 border border-basalt-900/5">
                  <h3 className="text-xl font-display font-bold text-basalt-900 mb-2">Need Inspiration?</h3>
                  <p className="text-basalt-600 mb-6">Select a template to get started instantly.</p>
                  <PromptSuggestions onSelect={setIdea} />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="bg-white/60 backdrop-blur-xl border border-basalt-900/10 rounded-[32px] p-8 md:p-10 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-copper-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                  
                  <div className="relative z-10 mb-10">
                    <div className="inline-flex items-center justify-center p-2 bg-copper-500/10 rounded-xl mb-4 text-copper-500">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="text-3xl font-display font-bold text-basalt-900">Clarifying Questions</h3>
                    <p className="text-lg text-basalt-600 mt-2">Let's refine your idea to generate the best possible prompt.</p>
                  </div>
                  
                  <form onSubmit={handleSynthesize} className="space-y-12 relative z-10">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="space-y-5">
                        <Label className="text-lg font-medium text-basalt-900 block flex items-start gap-4">
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-basalt-900/5 flex items-center justify-center text-sm font-bold text-basalt-500">
                            {idx + 1}
                          </span>
                          <span className="pt-1">{q.questionText}</span>
                        </Label>
                        
                        <div className="pl-12">
                          {q.questionType === 'free_text' && (
                            <Input 
                              value={answers[q.id] as string || ''}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Your answer..."
                              required
                            />
                          )}
                          {q.questionType === 'single_select' && (
                            <div className="relative">
                              <select 
                                className="flex h-12 w-full appearance-none rounded-xl border border-basalt-900/10 bg-white/50 px-4 py-2 text-base text-basalt-900 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 hover:border-basalt-900/20"
                                value={answers[q.id] as string || ''}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                required
                              >
                                <option value="" disabled>Select an option</option>
                                {q.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-basalt-600">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
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
                                        : "bg-white border-basalt-900/10 text-basalt-700 hover:border-basalt-900/20 hover:bg-basalt-900/5 hover:text-basalt-900"
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

                    <div className="pt-8 border-t border-basalt-900/5 flex justify-end pl-12">
                      <button
                        type="submit"
                        disabled={isSynthesizing}
                        className="inline-flex items-center justify-center rounded-xl bg-basalt-900 text-white hover:bg-basalt-800 px-8 py-4 text-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-basalt-900 disabled:opacity-50 w-full sm:w-auto"
                      >
                        {isSynthesizing ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                        ) : null}
                        Synthesize Prompt <Sparkles className="ml-2 w-5 h-5 text-copper-400" />
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
  );
}
