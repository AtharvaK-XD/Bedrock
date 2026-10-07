import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfile, resolveCleanName, resolveInitials } from '../../lib/useUserProfile';
import { useAuth } from '../../lib/useAuth';
import { useUser } from '@clerk/react';
import { isDesktopApp } from '../../lib/platform';
import { 
  LogOut, 
  LayoutDashboard, 
  Wand2, 
  GitBranch, 
  FlaskConical, 
  Bookmark, 
  History as HistoryIcon, 
  Sparkles 
} from 'lucide-react';
import { Menu, MenuItem, ProductItem, HoveredLink } from '../ui/navbar-menu';
import { openApiKeyModal } from '../../lib/apiKeyEvents';

const websiteNavItems = [
  { label: 'Dashboard', path: '/app' },
  { label: 'Generator', path: '/app/generator' },
  { label: 'Branching', path: '/app/branching' },
  { label: 'Prompt Tester', path: '/app/tester' },
  { label: 'Library', path: '/app/library' },
];

const desktopNavItems = [
  { label: 'Dashboard', path: '/app' },
  { label: 'Generator', path: '/app/generator' },
  { label: 'Branching', path: '/app/branching' },
  { label: 'Prompt Tester', path: '/app/tester' },
  { label: 'Library', path: '/app/library' },
  { label: 'History', path: '/app/history' },
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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
  const brandLink = '/app';

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

        {/* Center Nav - Floating Air Island (Centered at true 50% horizontal axis with Aceternity-style Animated Menu) */}
        <Menu setActive={setActiveMenu}>
          {navItems.map((item) => {
            const isActive = item.path === '/app' 
              ? location.pathname === '/app' 
              : location.pathname.startsWith(item.path);

            return (
              <MenuItem
                key={item.label}
                setActive={setActiveMenu}
                active={activeMenu}
                item={item.label}
                to={item.path}
                isActive={isActive}
              >
                {item.label === 'Dashboard' && (
                  <div className="flex flex-col space-y-3 text-sm w-72">
                    <div className="space-y-1">
                      <ProductItem
                        title="Telemetry & Overview"
                        description="Real-time prompt analytics, latency stats & system health."
                        to="/app"
                        icon={LayoutDashboard}
                      />
                      <ProductItem
                        title="Recent Activity"
                        description="Access and resume your latest generated prompt sessions."
                        to="/app"
                        icon={Bookmark}
                      />
                    </div>
                    <div className="border-t border-white/10 pt-2.5 flex flex-col space-y-1 px-1">
                      {!isDesktop && <HoveredLink to="/app/pricing">Plans & Token Quotas</HoveredLink>}
                      <HoveredLink to="/app/settings">API Integrations & Keys</HoveredLink>
                    </div>
                  </div>
                )}

                {item.label === 'Generator' && (
                  <div className="flex flex-col space-y-3 text-sm w-80">
                    <div className="space-y-1">
                      <ProductItem
                        title="Prompt Wizard"
                        description="Adaptive questioning engine for complete, build-ready prompts."
                        to="/app/generator"
                        icon={Wand2}
                      />
                      <ProductItem
                        title="Multi-Agent Synthesis"
                        description="Target Claude Code, Cursor, Codex, Gemini & custom agents."
                        to="/app/generator"
                        icon={Sparkles}
                      />
                    </div>
                    <div className="border-t border-white/10 pt-2.5 flex items-center justify-between px-1">
                      <HoveredLink to="/app/generator">Start Fresh Prompt</HoveredLink>
                      <HoveredLink to="/app/library">Import Blueprint</HoveredLink>
                    </div>
                  </div>
                )}

                {item.label === 'Branching' && (
                  <div className="flex flex-col space-y-3 text-sm w-80">
                    <div className="space-y-1">
                      <ProductItem
                        title="Visual Node Canvas"
                        description="Split, fork, and map complex multi-step reasoning trees."
                        to="/app/branching"
                        icon={GitBranch}
                      />
                      <ProductItem
                        title="Consensus & Merge"
                        description="Dispatch parallel reasoning prompts and evaluate agreement."
                        to="/app/branching"
                        icon={FlaskConical}
                      />
                    </div>
                    <div className="border-t border-white/10 pt-2.5 flex items-center justify-between px-1">
                      <HoveredLink to="/app/branching">Open Canvas</HoveredLink>
                      <HoveredLink to="/app/tester">Benchmark Results</HoveredLink>
                    </div>
                  </div>
                )}

                {item.label === 'Prompt Tester' && (
                  <div className="flex flex-col space-y-3 text-sm w-80">
                    <div className="space-y-1">
                      <ProductItem
                        title="Multi-LLM Playground"
                        description="Side-by-side completions across Gemini, Groq, Anthropic & OpenAI."
                        to="/app/tester"
                        icon={FlaskConical}
                      />
                      <ProductItem
                        title="Benchmark Matrix"
                        description="Evaluate latency, token throughput, and response accuracy."
                        to="/app/tester"
                        icon={LayoutDashboard}
                      />
                    </div>
                    <div className="border-t border-white/10 pt-2.5 flex items-center justify-between px-1">
                      <HoveredLink to="/app/tester">New Evaluation</HoveredLink>
                      <HoveredLink to="/app/settings">Provider Keys</HoveredLink>
                    </div>
                  </div>
                )}

                {item.label === 'Library' && (
                  <div className="flex flex-col space-y-3 text-sm w-80">
                    <div className="space-y-1">
                      <ProductItem
                        title="Curated Blueprints"
                        description="Production-vetted system prompts across engineering domains."
                        to="/app/library"
                        icon={Bookmark}
                      />
                      <ProductItem
                        title="Saved Prompts"
                        description="Your private collection of versioned and refined prompts."
                        to="/app/library"
                        icon={Wand2}
                      />
                    </div>
                    <div className="border-t border-white/10 pt-2.5 flex items-center justify-between px-1">
                      <HoveredLink to="/app/library">Explore All</HoveredLink>
                      <HoveredLink to="/app/generator">Create New</HoveredLink>
                    </div>
                  </div>
                )}

                {item.label === 'History' && (
                  <div className="flex flex-col space-y-2 text-sm w-72">
                    <ProductItem
                      title="Execution History"
                      description="Chronological log and telemetry of past prompt iterations."
                      to="/app/history"
                      icon={HistoryIcon}
                    />
                    <div className="border-t border-white/10 pt-2 px-1">
                      <HoveredLink to="/app/history">View Full Audit Log</HoveredLink>
                    </div>
                  </div>
                )}
              </MenuItem>
            );
          })}
        </Menu>

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
            <button 
              onClick={() => openApiKeyModal()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all border shadow-sm cursor-pointer",
                hasKeys
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              )}
              title={hasKeys ? "API Keys Connected (Click to manage)" : "No API Keys Connected (Click to setup)"}
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                hasKeys ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              )} />
              <span className="font-mono text-[11px]">{hasKeys ? 'Keys Active' : 'Configure Keys'}</span>
            </button>
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
