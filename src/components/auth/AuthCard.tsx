import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface AuthCardProps {
  initialMode?: 'login' | 'register';
}

export function AuthCard({ initialMode = 'login' }: AuthCardProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigate('/app');
    }, 800);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-400 mt-2 text-sm">
              {mode === 'login' ? 'Enter your credentials to continue.' : 'Start building high-precision prompts today.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    required={mode === 'register'}
                    className="w-full bg-transparent border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-copper-500/50 transition-all text-sm"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <input 
                type="email" 
                placeholder="Email address" 
                required
                className="w-full bg-transparent border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-copper-500/50 transition-all text-sm"
              />
            </div>

            <div>
              <input 
                type="password" 
                placeholder="Password" 
                required
                className="w-full bg-transparent border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-copper-500/50 transition-all text-sm font-mono"
              />
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs font-mono text-copper-400 hover:text-copper-300 transition-colors cursor-pointer">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-xl py-3.5 font-semibold text-sm hover:bg-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-70 mt-4 cursor-pointer active:scale-[0.98]"
            >
              {isLoading && (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block"></span>
              )}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-black/60 backdrop-blur-md text-gray-500 font-mono uppercase tracking-wider">Or</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="w-full py-3 bg-transparent border border-white/10 rounded-xl font-mono text-xs uppercase tracking-wider text-white hover:bg-white/5 transition-all focus:outline-none cursor-pointer"
            >
              {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="w-full py-3 bg-transparent border border-white/10 rounded-xl font-mono text-xs uppercase tracking-wider text-white hover:bg-white/5 transition-all focus:outline-none cursor-pointer"
            >
              {mode === 'login' ? 'Continue with GitHub' : 'Sign up with GitHub'}
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-gray-400">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-white hover:underline font-semibold cursor-pointer ml-1"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
