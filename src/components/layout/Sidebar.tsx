import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../../lib/useUserProfile';
import { useAuth } from '../../lib/useAuth';
import { useUser } from '@clerk/react';
import { 
  LayoutDashboard,
  Wand2, 
  GitBranch, 
  FlaskConical, 
  Bookmark, 
  Settings, 
  KeyRound, 
  LogOut, 
  ChevronRight
} from 'lucide-react';

const desktopNavItems = [
  { label: 'Dashboard', path: '/app', icon: LayoutDashboard, shortcut: '⌘1' },
  { label: 'Generator', path: '/app/generator', icon: Wand2, shortcut: '⌘2' },
  { label: 'Branching', path: '/app/branching', icon: GitBranch, shortcut: '⌘3' },
  { label: 'Prompt Tester', path: '/app/tester', icon: FlaskConical, shortcut: '⌘4' },
  { label: 'Library', path: '/app/library', icon: Bookmark, shortcut: '⌘5' },
];

interface SidebarProps {
  onOpenKeyModal?: () => void;
}

export function Sidebar({ onOpenKeyModal }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { logout } = useAuth();
  const { user: clerkUser } = useUser();
  const displayAvatar = profile.avatarUrl || clerkUser?.imageUrl;

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
    <aside className="w-64 h-full border-r border-white/[0.08] bg-[#07090e]/95 backdrop-blur-2xl flex flex-col shrink-0 select-none z-30 relative shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      {/* Specular top-right edge highlight */}
      <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

      {/* Brand Header */}
      <div className="p-5 pb-4 flex items-center justify-between border-b border-white/[0.06]">
        <Link to="/app" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center p-1 shadow-sm group-hover:border-emerald-500/30 group-hover:bg-white/[0.07] transition-all">
            <img src="/logo-tight.png" alt="Bedrock" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(139,212,186,0.3)] group-hover:scale-105 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-tight text-white leading-tight">Bedrock</span>
            <span className="text-[10px] font-mono text-gray-500 tracking-wider uppercase">Workstation</span>
          </div>
        </Link>
        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-copper-300">
          v1.2.1
        </span>
      </div>

      {/* Workspaces Navigation */}
      <div className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
        <div>
          <p className="px-3 mb-2 text-[10px] font-mono font-semibold tracking-wider text-gray-500 uppercase">
            Workspaces
          </p>
          <nav className="space-y-1">
            {desktopNavItems.map((item) => {
              const isActive = item.path === '/app'
                ? (location.pathname === '/app' || location.pathname === '/app/')
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                    isActive
                      ? "bg-white/[0.12] text-white border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.4)] font-semibold"
                      : "text-gray-400 border-transparent hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-copper-400" : "text-gray-400 group-hover:text-white")} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-600 group-hover:text-gray-400 transition-colors">
                    {item.shortcut}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* System & Configuration Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-mono font-semibold tracking-wider text-gray-500 uppercase">
            Configuration
          </p>
          <div className="space-y-1">
            <button
              onClick={() => {
                if (onOpenKeyModal) {
                  onOpenKeyModal();
                } else {
                  navigate('/app/settings');
                }
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border text-left cursor-pointer",
                hasKeys
                  ? "bg-emerald-500/[0.06] text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/10"
                  : "bg-amber-500/[0.08] text-amber-300 border-amber-500/25 hover:bg-amber-500/15"
              )}
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4" />
                <span>API Keys</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                {hasKeys ? 'Connected' : 'Setup'}
              </span>
            </button>

            <Link
              to="/app/settings"
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                location.pathname === '/app/settings'
                  ? "bg-white/[0.12] text-white border-white/15 font-semibold"
                  : "text-gray-400 border-transparent hover:text-white hover:bg-white/[0.05]"
              )}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* User Session & Logout Footer */}
      <div className="p-3 border-t border-white/[0.08] bg-black/40 space-y-2">
        <Link 
          to="/app/profile" 
          className={cn(
            "flex items-center gap-3 p-2 rounded-xl group transition-all duration-200 border",
            location.pathname === '/app/profile'
              ? "bg-white/10 border-copper-500/40 shadow-sm shadow-copper-500/10"
              : "border-transparent hover:bg-white/5 hover:border-white/10"
          )}
          title="View Profile"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-transparent group-hover:ring-copper-400/50 transition-all overflow-hidden shrink-0">
            {displayAvatar ? (
              <img src={displayAvatar} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              profile.avatarInitials
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-white truncate leading-tight group-hover:text-copper-300 transition-colors">
              {profile.name}
            </p>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
              Local Session
            </p>
          </div>
        </Link>

        <button
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
