import { useState } from 'react';
import { cn } from '../../lib/utils';
import { MessageSquare, Briefcase, Zap, Terminal } from 'lucide-react';

const categories = ['Recommended', 'General', 'Coding', 'Marketing', 'Writing'];

const suggestions = [
  {
    title: 'Code Review Agent',
    description: 'Help me review a tricky pull request in a legacy codebase',
    category: 'Coding',
    icon: Terminal
  },
  {
    title: 'Landing Page Copy',
    description: 'Write a headline that converts casual browsers into buyers',
    category: 'Marketing',
    icon: Zap
  },
  {
    title: 'Concept Explanation',
    description: 'Help me explain a complex topic in plain English',
    category: 'General',
    icon: MessageSquare
  },
  {
    title: 'Freelance Brief',
    description: 'Create a detailed brief for a UX designer',
    category: 'Recommended',
    icon: Briefcase
  }
];

export function PromptSuggestions({ onSelect }: { onSelect: (text: string) => void }) {
  const [activeCategory, setActiveCategory] = useState('Recommended');

  const filteredSuggestions = activeCategory === 'Recommended' 
    ? suggestions 
    : suggestions.filter(s => s.category === activeCategory);

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <span className="text-sm font-medium text-basalt-500 mr-2">Prompt Suggestions</span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              activeCategory === cat 
                ? "bg-basalt-900 text-white shadow-md" 
                : "bg-white/50 text-basalt-700 border border-basalt-900/10 hover:border-basalt-900/20 hover:bg-white"
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
            className="text-left bg-white/60 backdrop-blur-sm border border-basalt-900/10 rounded-2xl p-5 transition-all hover:bg-white hover:border-copper-500/30 hover:shadow-lg hover:-translate-y-1 group flex flex-col"
          >
            <div className="p-2 bg-basalt-900/5 rounded-lg w-fit mb-4 group-hover:bg-copper-500/10 transition-colors">
              <suggestion.icon className="w-5 h-5 text-basalt-600 group-hover:text-copper-500 transition-colors" />
            </div>
            <h4 className="font-semibold text-basalt-900 mb-2">{suggestion.title}</h4>
            <p className="text-sm text-basalt-600 leading-relaxed flex-1">{suggestion.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
