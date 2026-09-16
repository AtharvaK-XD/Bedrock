import { useState } from 'react';
import { cn } from '../../lib/utils';

const categories = ['Recommended', 'General', 'Coding', 'Marketing', 'Writing'];

const suggestions = [
  {
    title: 'Code Review Agent',
    description: 'Help me review a tricky pull request in a legacy codebase',
    category: 'Coding',
    tag: 'CODE'
  },
  {
    title: 'Landing Page Copy',
    description: 'Write a headline that converts casual browsers into buyers',
    category: 'Marketing',
    tag: 'MKTG'
  },
  {
    title: 'Concept Explanation',
    description: 'Help me explain a complex topic in plain English',
    category: 'General',
    tag: 'GEN'
  },
  {
    title: 'Freelance Brief',
    description: 'Create a detailed brief for a UX designer',
    category: 'Recommended',
    tag: 'RECOM'
  }
];

export function PromptSuggestions({ onSelect }: { onSelect: (text: string) => void }) {
  const [activeCategory, setActiveCategory] = useState('Recommended');

  const filteredSuggestions = activeCategory === 'Recommended' 
    ? suggestions 
    : suggestions.filter(s => s.category === activeCategory);

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
        <span className="text-xs font-mono uppercase tracking-wider text-gray-400 mr-2">Suggestions</span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              activeCategory === cat 
                ? "bg-white text-black shadow-sm font-semibold" 
                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {filteredSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(suggestion.description)}
            className="text-left bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 transition-all hover:bg-white/[0.07] hover:border-copper-500/40 hover:shadow-lg group flex flex-col"
          >
            <div className="mb-3">
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400 group-hover:text-copper-300 group-hover:border-copper-500/30 transition-colors">
                {suggestion.tag}
              </span>
            </div>
            <h4 className="font-semibold text-white text-sm mb-2 tracking-tight">{suggestion.title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed flex-1">{suggestion.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
