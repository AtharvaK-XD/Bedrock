import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Sparkles, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { mockGenerateQuestions, mockSynthesizePrompt } from '../lib/mockApi';
import type { Question, Answer, IdeaPayload } from '../lib/mockApi';
import { cn } from '../lib/utils';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function Wizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [idea, setIdea] = useState('');
  const [targetType, setTargetType] = useState<IdeaPayload['targetType']>('coding_agent');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleGenerateQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="max-w-3xl mx-auto pt-24 px-4 pb-32">
      <div className="text-center mb-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center justify-center p-2 bg-basalt-800/50 backdrop-blur-md rounded-2xl mb-6 border border-white/5 shadow-2xl">
            <Layers className="w-8 h-8 text-copper-400" />
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight drop-shadow-md">
            Bedrock
          </h1>
          <p className="text-lg md:text-xl text-sandstone-200 max-w-xl mx-auto font-light">
            Turn a vague idea into a solid, build-ready prompt.
          </p>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -30, filter: 'blur(10px)', scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card>
              <form onSubmit={handleGenerateQuestions}>
                <CardHeader>
                  <CardTitle>What are you building?</CardTitle>
                  <CardDescription>Enter a one-line idea, and we'll ask the right questions to structure it.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-3">
                    <Label htmlFor="idea">Project Idea</Label>
                    <Input 
                      id="idea"
                      placeholder="e.g., A multi-vendor marketplace for indie makers"
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="target">Output For</Label>
                    <div className="relative">
                      <select 
                        id="target"
                        className="flex h-11 w-full appearance-none rounded-lg border border-white/10 bg-basalt-900/50 px-4 py-2 text-sm text-sandstone-50 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 hover:border-white/20"
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value as IdeaPayload['targetType'])}
                      >
                        <option value="coding_agent">AI Coding Agent (Claude, Cursor, v0)</option>
                        <option value="freelancer_brief">Human Developer / Freelancer</option>
                        <option value="hackathon_pitch">Hackathon Pitch</option>
                        <option value="no_code">No-Code Tool</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-sandstone-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" isLoading={isGenerating} className="w-full text-base h-12">
                    Generate Questions <Sparkles className="ml-2 w-4 h-4" />
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card>
              <form onSubmit={handleSynthesize}>
                <CardHeader>
                  <CardTitle>Clarifying Questions</CardTitle>
                  <CardDescription>Let's add some layers to the foundation.</CardDescription>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-10"
                  >
                    {questions.map((q) => (
                      <motion.div 
                        key={q.id}
                        variants={itemVariants}
                        className="space-y-4"
                      >
                        <Label className="text-base text-sandstone-50 block">{q.questionText}</Label>
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
                              className="flex h-11 w-full appearance-none rounded-lg border border-white/10 bg-basalt-900/50 px-4 py-2 text-sm text-sandstone-50 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 hover:border-white/20"
                              value={answers[q.id] as string || ''}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              required
                            >
                              <option value="" disabled>Select an option</option>
                              {q.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-sandstone-400">
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
                                    "px-5 py-2.5 text-sm rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500",
                                    isSelected 
                                      ? "bg-copper-500/10 border-copper-500 text-copper-400 shadow-[0_0_15px_rgba(44,154,139,0.2)]" 
                                      : "bg-basalt-900/50 border-white/10 text-sandstone-300 hover:border-white/20 hover:bg-basalt-800/80"
                                  )}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                </CardContent>
                <CardFooter className="pt-6">
                  <Button type="submit" isLoading={isSynthesizing} className="w-full text-base h-12">
                    Synthesize Prompt <Sparkles className="ml-2 w-4 h-4" />
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
