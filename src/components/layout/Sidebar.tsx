import { cn } from '../../lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { useUserProfile } from '../../lib/useUserProfile';

const navItems = [
  { label: 'Generator', path: '/app/generator' },
  { label: 'Branching', path: '/app/branching' },
  { label: 'Prompt Tester', path: '/app/tester' },
  { label: 'Library', path: '/app/library' },
  { label: 'Settings', path: '/app/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile } = useUserProfile();

  return (
    <div className="w-64 h-screen border-r border-white/10 bg-black/80 backdrop-blur-xl flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6">
        <Link to="/app" className="flex items-center gap-2.5 text-white group">
          <span className="w-2 h-2 rounded-full bg-copper-400 shadow-[0_0_8px_rgba(200,168,107,0.8)]" />
          <span className="font-display font-bold text-xl tracking-wider uppercase">Bedrock</span>
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
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-white/10 text-white font-semibold shadow-sm" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <span>{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-copper-400" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <Link 
          to="/app/profile" 
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-semibold overflow-hidden border border-white/10">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              profile.avatarInitials
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{profile.name}</p>
            <p className="text-xs font-mono text-gray-500 truncate">{profile.plan}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
