import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../../lib/useUserProfile';
import { useAuth } from '../../lib/useAuth';
import { LogOut } from 'lucide-react';

const navItems = [
  { label: 'Generator', path: '/app/generator' },
  { label: 'Branching', path: '/app/branching' },
  { label: 'Prompt Tester', path: '/app/tester' },
  { label: 'Library', path: '/app/library' },
];

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { logout } = useAuth();

  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    const checkKeys = () => {
      try {
        const raw = localStorage.getItem('bedrock_api_keys');
        if (!raw) {
          setHasKeys(false);
          return;
        }
        const parsed = JSON.parse(raw);
        setHasKeys(Boolean(parsed.geminiKey || parsed.groqKey || parsed.openAiKey || parsed.anthropicKey || parsed.openRouterKey));
      } catch {
        setHasKeys(false);
      }
    };
    checkKeys();
    window.addEventListener('bedrock_api_keys_updated', checkKeys);
    window.addEventListener('storage', checkKeys);
    return () => {
      window.removeEventListener('bedrock_api_keys_updated', checkKeys);
      window.removeEventListener('storage', checkKeys);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-20 border-b border-white/[0.08] bg-[#07090e]/75 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
      <div className="w-full px-4 sm:px-8 h-full flex items-center justify-between">
        
        {/* Brand - Desktop Workstation */}
        <Link to="/app/generator" className="flex items-center gap-2.5 text-white group">
          <span className="w-2.5 h-2.5 rounded-full bg-copper-400 shadow-[0_0_10px_rgba(200,168,107,0.9)] transition-transform group-hover:scale-125" />
          <span className="font-display font-bold text-lg tracking-wider uppercase text-white">Bedrock</span>
        </Link>

        {/* Center Nav - Core Prompt Workstations */}
        <nav className="hidden md:flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/10 shadow-sm backdrop-blur-xl">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
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

        {/* Right Actions: API Key Status & Settings */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link 
            to="/app/settings" 
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl transition-all border shadow-sm",
              location.pathname === '/app/settings'
                ? "bg-white/10 text-white border-white/20"
                : "bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/8 border-white/10"
            )}
            title={hasKeys ? "API Keys Connected" : "No API Keys Connected"}
          >
            <span className={`w-2 h-2 rounded-full ${hasKeys ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`} />
            <span className="font-mono text-[11px]">{hasKeys ? 'Keys Active' : 'Configure Keys'}</span>
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
                <span>Local Session</span>
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
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Log Out of Desktop Workstation"
            className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
