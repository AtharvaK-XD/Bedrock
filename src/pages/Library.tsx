import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Copy, MoreVertical, Filter, Tag } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

const MOCK_SAVED_PROMPTS = [
  { id: '1', title: 'Code Review Assistant', tags: ['Coding', 'System'], date: '2 hours ago', snippet: 'You are an expert code reviewer. Analyze the following pull request for security vulnerabilities, performance bottlenecks, and...' },
  { id: '2', title: 'SEO Landing Page', tags: ['Marketing', 'Copywriting'], date: 'Yesterday', snippet: 'Write a high-converting landing page headline and subheadline for a new SaaS product that helps developers...' },
  { id: '3', title: 'SQL Query Optimizer', tags: ['Database', 'Coding'], date: '3 days ago', snippet: 'Given the following PostgreSQL schema and slow query, identify the performance bottlenecks and rewrite the query using...' },
  { id: '4', title: 'UX Persona Generator', tags: ['Design', 'Product'], date: '1 week ago', snippet: 'Create 3 distinct user personas for a new fintech mobile app targeting Gen-Z users. For each persona, include their goals...' },
  { id: '5', title: 'Blog Post Outline', tags: ['Writing'], date: '2 weeks ago', snippet: 'Create a comprehensive, SEO-optimized outline for a 2000-word blog post about the future of Artificial Intelligence in...' },
  { id: '6', title: 'Regex Explainer', tags: ['Coding', 'Utility'], date: '1 month ago', snippet: 'Explain what the following regular expression does in plain English. Break it down token by token: ^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$' },
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
    <div className="w-full px-6 lg:px-12 2xl:px-24 py-6 lg:py-10 min-h-[calc(100vh-80px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>

          <h1 className="text-5xl md:text-6xl font-editorial font-bold text-white tracking-tight mb-2 leading-[1.1]">
            Prompt Library.
          </h1>
        </div>

        <div className="w-full md:w-auto flex items-center gap-4">
          <div className="relative flex-1 md:w-80">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-11 pr-4 py-3 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm"
            />
          </div>
          <Button variant="secondary" className="h-[50px] px-4 bg-[#1a1a1a]/60 text-white border-white/10 hover:bg-white/10 backdrop-blur-sm">
            <Filter className="w-5 h-5 mr-2" /> Filter
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-4 mb-8 gap-2 custom-scrollbar">
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeTag === tag
                ? "bg-white text-black shadow-md"
                : "bg-[#1a1a1a]/60 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white shadow-sm"
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPrompts.map((prompt) => (
          <motion.div
            key={prompt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a1a]/40 backdrop-blur-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] rounded-3xl p-6 flex flex-col group hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:bg-white/10 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white line-clamp-1">{prompt.title}</h3>
              <button className="text-gray-500 hover:text-white transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-400 text-sm line-clamp-3 mb-6 flex-1">
              {prompt.snippet}
            </p>

            <div className="flex flex-col gap-4 mt-auto">
              <div className="flex items-center gap-2 flex-wrap">
                {prompt.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/10 text-xs font-semibold text-gray-300">
                    <Tag className="w-3 h-3 mr-1 opacity-50" />
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-xs text-gray-500">{prompt.date}</span>
                <button
                  onClick={() => handleCopy(prompt.snippet)}
                  className="flex items-center gap-2 text-sm font-semibold text-teal-500 hover:text-teal-400 transition-colors"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredPrompts.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
            <Search className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No prompts found matching your criteria.</p>
            <Button variant="ghost" className="mt-4 text-teal-500" onClick={() => { setSearch(''); setActiveTag('All'); }}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
