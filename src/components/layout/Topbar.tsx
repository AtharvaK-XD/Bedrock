import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfile, resolveCleanName, resolveInitials } from '../../lib/useUserProfile';
import { useAuth } from '../../lib/useAuth';
import { useUser } from '@clerk/react';
import { isDesktopApp } from '../../lib/platform';
import { LogOut } from 'lucide-react';

const websiteNavItems = [
  { label: 'Dashboard', path: '/app' },
  { label: 'Generator', path: '/app/generator' },
  { label: 'Branching', path: '/app/branching' },
  { label: 'Prompt Tester', path: '/app/tester' },
  { label: 'Library', path: '/app/library' },
];

const desktopNavItems = [
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
  const { user: clerkUser } = useUser();
  const isDesktop = isDesktopApp();

  const displayName = 
    clerkUser?.fullName || 
    clerkUser?.firstName || 
    resolveCleanName(profile.name, clerkUser?.primaryEmailAddress?.emailAddress || profile.email);
  const displayAvatar = profile.avatarUrl || clerkUser?.imageUrl;
  const displayInitials = resolveInitials(displayName);

  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
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
  }, [isDesktop]);

  const navItems = isDesktop ? desktopNavItems : websiteNavItems;
  const brandLink = isDesktop ? '/app/generator' : '/app';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-20 bg-transparent pointer-events-none">
      <div className="relative w-full px-4 sm:px-8 h-full flex items-center justify-between">
        
        {/* Brand */}
        <Link 
          to={brandLink} 
          className="pointer-events-auto flex items-center gap-2.5 py-1 text-white group hover:opacity-90 transition-all select-none active:scale-[0.98]"
        >
          <img 
            src="/logo-tight.png" 
            alt="Bedrock Logo" 
            className="w-7 h-7 object-contain filter drop-shadow-[0_0_10px_rgba(139,212,186,0.35)] group-hover:scale-105 transition-transform" 
          />
          <span className="font-display font-bold text-lg tracking-tight text-white group-hover:text-copper-400 transition-colors">
            Bedrock
          </span>
        </Link>

        {/* Center Nav - Floating Air Island (Centered at true 50% horizontal axis) */}
        <nav className="pointer-events-auto hidden md:flex items-center gap-1 bg-black/45 p-1.5 rounded-2xl border border-white/10 shadow-lg shadow-black/30 backdrop-blur-xl absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {navItems.map((item) => {
            const isActive = item.path === '/app' 
              ? location.pathname === '/app' 
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "px-3.5 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium transition-all duration-200 whitespace-nowrap",
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

        {/* Right User Actions - Floating Air Island */}
        <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 bg-black/45 p-1.5 px-3 rounded-2xl border border-white/10 shadow-lg shadow-black/30 backdrop-blur-xl">
          {/* Website only: Upgrade to Pro button */}
          {!isDesktop && (
            <Link to="/app/pricing" className="hidden md:flex items-center justify-center px-3.5 py-1.5 bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white text-xs font-semibold uppercase tracking-wider rounded-full shadow-md shadow-copper-500/25 transition-all border border-copper-400/30">
              Upgrade
            </Link>
          )}

          {/* Desktop only: API Key Status Pill */}
          {isDesktop && (
            <Link 
              to="/app/settings" 
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all border shadow-sm",
                location.pathname === '/app/settings'
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/8 border-white/10"
              )}
              title={hasKeys ? "API Keys Connected" : "No API Keys Connected"}
            >
              <span className="font-mono text-[11px]">{hasKeys ? 'Keys Active' : 'Configure Keys'}</span>
            </Link>
          )}

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
          <div className="h-5 w-px bg-white/10 hidden sm:block" />
          <Link 
            to="/app/profile" 
            className={cn(
              "flex items-center gap-2.5 p-1 rounded-xl group transition-all duration-200 border",
              location.pathname === '/app/profile'
                ? "bg-white/10 border-copper-500/40 shadow-sm shadow-copper-500/10"
                : "border-transparent hover:bg-white/5 hover:border-white/10"
            )}
            title="View Profile"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-white leading-none group-hover:text-copper-300 transition-colors">{displayName}</p>
              <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                {isDesktop ? 'Local Session' : profile.plan}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-transparent group-hover:ring-copper-400/50 transition-all overflow-hidden">
              {displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                displayInitials
              )}
            </div>
          </Link>

          {/* Quick Logout button */}
          <button
            onClick={async () => {
              await logout();
              navigate(isDesktop ? '/login' : '/');
            }}
            title="Log Out"
            className="p-1.5 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
