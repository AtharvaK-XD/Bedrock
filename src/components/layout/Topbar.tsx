import { cn } from '../../lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { useUserProfile } from '../../lib/useUserProfile';

const navItems = [
  { label: 'Dashboard', path: '/app' },
  { label: 'Generator', path: '/app/generator' },
  { label: 'Branching', path: '/app/branching' },
  { label: 'Prompt Tester', path: '/app/tester' },
  { label: 'Library', path: '/app/library' },
];

export function Topbar() {
  const location = useLocation();
  const { profile } = useUserProfile();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/[0.08] bg-[#07090e]/75 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
      <div className="w-full px-4 sm:px-8 h-full flex items-center justify-between">
        
        {/* Brand - Minimalist Typography */}
        <Link to="/app" className="flex items-center gap-2.5 text-white group">
          <span className="w-2.5 h-2.5 rounded-full bg-copper-400 shadow-[0_0_10px_rgba(200,168,107,0.9)] transition-transform group-hover:scale-125" />
          <span className="font-display font-bold text-lg tracking-wider uppercase text-white">Bedrock</span>
        </Link>

        {/* Center Nav - Pure Typography */}
        <nav className="hidden md:flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/10 shadow-sm backdrop-blur-xl">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-white/15 text-white shadow-sm font-semibold border border-white/15" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right User Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/app/pricing" className="hidden md:flex items-center justify-center px-4 py-1.5 bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white text-xs font-semibold uppercase tracking-wider rounded-full shadow-lg shadow-copper-500/25 transition-all border border-copper-400/30">
            Upgrade
          </Link>
          <Link 
            to="/app/settings" 
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-xl transition-colors border",
              location.pathname === '/app/settings'
                ? "bg-white/10 text-white border-white/20"
                : "text-gray-400 hover:text-white hover:bg-white/5 border-transparent"
            )}
          >
            Settings
          </Link>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <Link 
            to="/app/profile" 
            className={cn(
              "flex items-center gap-3 p-1.5 -mr-1.5 rounded-2xl group transition-all duration-200 border",
              location.pathname === '/app/profile'
                ? "bg-white/10 border-copper-500/40 shadow-sm shadow-copper-500/10"
                : "border-transparent hover:bg-white/5 hover:border-white/10"
            )}
            title="View Profile"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white leading-none group-hover:text-copper-300 transition-colors">{profile.name}</p>
              <p className="text-[11px] font-mono text-gray-400 mt-1 flex items-center justify-end gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {profile.plan}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-transparent group-hover:ring-copper-400/50 transition-all overflow-hidden">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile.avatarInitials
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
