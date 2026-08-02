import { Layers, Sparkles, Wand2, FlaskConical, BookOpen, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { icon: Sparkles, label: 'Generator', path: '/' },
  { icon: Wand2, label: 'Optimizer', path: '#' },
  { icon: FlaskConical, label: 'Prompt Tester', path: '#' },
  { icon: BookOpen, label: 'Library', path: '#' },
];

export function Topbar() {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-basalt-900/5 bg-white/40 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
        
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 text-basalt-900 group">
          <div className="p-1.5 bg-copper-500/10 rounded-lg group-hover:bg-copper-500/20 transition-colors">
            <Layers className="w-6 h-6 text-copper-500" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">Bedrock</span>
        </Link>

        {/* Center Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-white/60 p-1.5 rounded-2xl border border-basalt-900/10 shadow-sm">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300",
                  isActive 
                    ? "bg-basalt-900 text-white shadow-md" 
                    : "text-basalt-600 hover:text-basalt-900 hover:bg-basalt-900/5"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-copper-400" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right User Actions */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-basalt-500 hover:bg-basalt-900/5 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-basalt-900/10"></div>
          <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-basalt-900 leading-none">Atharva K.</p>
              <p className="text-xs text-basalt-500 mt-1">Free Plan</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center font-bold shadow-md">
              AK
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
