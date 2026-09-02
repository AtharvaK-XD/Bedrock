import { Layers, Sparkles, GitBranch, FlaskConical, BookOpen, ListChecks, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { useUserProfile } from '../../lib/useUserProfile';

const navItems = [
  { icon: Sparkles, label: 'Generator', path: '/' },
  { icon: GitBranch, label: 'Branching', path: '/app/branching' },
  { icon: FlaskConical, label: 'Prompt Tester', path: '#' },
  { icon: BookOpen, label: 'Library', path: '#' },
  { icon: ListChecks, label: 'Instructions', path: '#' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile } = useUserProfile();

  return (
    <div className="w-64 h-screen border-r border-basalt-900/10 bg-white/40 backdrop-blur-xl flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-3 text-basalt-900 group">
          <div className="p-1.5 bg-copper-500/10 rounded-lg group-hover:bg-copper-500/20 transition-colors">
            <Layers className="w-6 h-6 text-copper-500" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">Bedrock</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-basalt-900/5 text-basalt-900" 
                  : "text-basalt-700 hover:bg-basalt-900/5 hover:text-basalt-900"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "text-copper-500" : "text-basalt-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-basalt-900/5">
        <Link 
          to="/app/profile" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-basalt-900/5 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-basalt-900 text-white flex items-center justify-center text-xs font-semibold">
            {profile.avatarInitials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-basalt-900 truncate">{profile.name}</p>
            <p className="text-xs text-basalt-500 truncate">{profile.plan}</p>
          </div>
          <Settings className="w-4 h-4 text-basalt-400" />
        </Link>
      </div>
    </div>
  );
}
