import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';

const MOCK_SAVED_PROMPTS = [
  { id: '1', title: 'Code Review Assistant', tags: ['Coding', 'System'], date: '2 hours ago', snippet: 'You are an expert code reviewer. Analyze the following pull request for security vulnerabilities, performance bottlenecks, and...' },
  { id: '2', title: 'SEO Landing Page', tags: ['Marketing', 'Copywriting'], date: 'Yesterday', snippet: 'Write a high-converting landing page headline and subheadline for a new SaaS product that helps developers...' },
  { id: '3', title: 'SQL Query Optimizer', tags: ['Database', 'Coding'], date: '3 days ago', snippet: 'Given the following PostgreSQL schema and slow query, identify the performance bottlenecks and rewrite the query using...' },
  { id: '4', title: 'UX Persona Generator', tags: ['Design', 'Product'], date: '1 week ago', snippet: 'Create 3 distinct user personas for a new fintech mobile app targeting Gen-Z users. For each persona, include their goals...' },
  { id: '5', title: 'Blog Post Outline', tags: ['Writing'], date: '2 weeks ago', snippet: 'Create a comprehensive, SEO-optimized outline for a 2000-word blog post about the future of Artificial Intelligence in...' },
  { id: '6', title: 'Regex Explainer', tags: ['Coding', 'Utility'], date: '1 month ago', snippet: 'Explain what the following regular expression does in plain English. Break it down token by token: ^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$' },
];

const ALL_TAGS = ['All', 'Coding', 'Marketing', 'Writing', 'Design', 'Database', 'System', 'Utility', 'Product'];

export default function Library() {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('All');

  const filteredPrompts = MOCK_SAVED_PROMPTS.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.snippet.toLowerCase().includes(search.toLowerCase());
    const matchesTag = activeTag === 'All' || p.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  const handleCopy = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    alert('Prompt copied!');
  };

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-6 lg:py-10 min-h-[calc(100vh-80px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h1 className="text-5xl md:text-6xl font-editorial font-bold text-white tracking-tight mb-2 leading-[1.1]">
            Prompt Library.
          </h1>
        </div>

        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="w-full px-4 py-3 bg-[#1a1a1a]/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-copper-500/50 text-sm shadow-sm"
            />
          </div>
          <Button variant="secondary" className="h-[46px] px-5 bg-[#1a1a1a]/40 text-white border-white/10 hover:bg-white/10 backdrop-blur-sm text-xs font-mono uppercase tracking-wider">
            Filter
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-4 mb-8 gap-2 custom-scrollbar">
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={cn(
              "whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all uppercase tracking-wider",
              activeTag === tag
                ? "bg-white text-black shadow-sm font-semibold"
                : "bg-[#1a1a1a]/30 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white shadow-sm"
            )}
          >
            {tag}
          </button>
        ))}
      </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
        >
        {filteredPrompts.map((prompt) => (
          <motion.div
            key={prompt.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.01 }}
            className="bg-[#1a1a1a]/30 backdrop-blur-xl border border-white/5 rounded-3xl p-8 hover:bg-[#1a1a1a]/50 hover:border-white/15 transition-all group flex flex-col shadow-lg relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white line-clamp-1">{prompt.title}</h3>
              <button className="text-gray-500 hover:text-white transition-colors font-mono text-sm leading-none px-1">
                •••
              </button>
            </div>

            <p className="text-gray-400 text-sm line-clamp-3 mb-6 flex-1 leading-relaxed">
              {prompt.snippet}
            </p>

            <div className="flex flex-col gap-4 mt-auto">
              <div className="flex items-center gap-2 flex-wrap">
                {prompt.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-gray-300">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs font-mono text-gray-500">{prompt.date}</span>
                <button
                  onClick={() => handleCopy(prompt.snippet)}
                  className="text-xs font-mono font-semibold text-copper-400 hover:text-copper-300 uppercase tracking-wider transition-colors"
                >
                  Copy Prompt
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredPrompts.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 text-center">
            <p className="text-lg font-medium text-white/80">No prompts found matching your criteria.</p>
            <p className="text-xs font-mono text-gray-500 mt-1">Try another search keyword or reset category tag.</p>
            <Button variant="ghost" className="mt-4 text-copper-400 font-mono text-xs uppercase tracking-wider" onClick={() => { setSearch(''); setActiveTag('All'); }}>
              Clear filters
            </Button>
          </div>
        )}
        </motion.div>
      </div>
    </PageTransition>
  );
}
