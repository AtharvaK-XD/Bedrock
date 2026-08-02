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
      navigate('/result', { state: { promptText } });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pt-16 px-6 lg:px-8 pb-32">
      <div className="text-center mb-12 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-display font-bold text-basalt-900 mb-4 tracking-tight">
            Craft Perfect Prompt in Seconds
          </h1>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto"
      >
        <RichInput
          value={idea}
          onChange={setIdea}
          onSubmit={handleGenerateQuestions}
          isLoading={isGenerating}
          targetType={targetType}
          onTargetTypeChange={setTargetType}
          placeholder="Describe what you want to accomplish..."
        />
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ duration: 0.4 }}
            >
              <PromptSuggestions onSelect={setIdea} />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12"
            >
              <div className="bg-white/60 backdrop-blur-xl border border-basalt-900/10 rounded-3xl p-8 shadow-sm">
                <div className="mb-8">
                  <h3 className="text-2xl font-display font-bold text-basalt-900">Clarifying Questions</h3>
                  <p className="text-basalt-600 mt-1">Let's refine your idea to generate the best possible prompt.</p>
                </div>
                
                <form onSubmit={handleSynthesize} className="space-y-10">
                  {questions.map((q) => (
                    <div key={q.id} className="space-y-4">
                      <Label className="text-base font-semibold text-basalt-900 block">{q.questionText}</Label>
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
                            className="flex h-11 w-full appearance-none rounded-lg border border-basalt-900/10 bg-white/50 px-4 py-2 text-sm text-basalt-900 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 hover:border-basalt-900/20"
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
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
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
                                  "px-5 py-2.5 text-sm rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 font-medium",
                                  isSelected 
                                    ? "bg-copper-500/10 border-copper-500 text-copper-600 shadow-[0_0_15px_rgba(44,154,139,0.1)]" 
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
                  ))}

                  <div className="pt-6 border-t border-basalt-900/5 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSynthesizing}
                      className="inline-flex items-center justify-center rounded-xl bg-copper-500 text-white hover:bg-copper-400 px-8 py-3 font-medium shadow-[0_0_20px_rgba(44,154,139,0.3)] hover:shadow-[0_0_25px_rgba(44,154,139,0.5)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 disabled:opacity-50"
                    >
                      {isSynthesizing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      ) : null}
                      Synthesize Prompt <Sparkles className="ml-2 w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
