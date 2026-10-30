import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { ApiKeyGatewayModal } from '../auth/ApiKeyGatewayModal';
import { ApiKeyPromptModal } from '../ui/ApiKeyPromptModal';
import { hasApiKeysConfigured } from '../../lib/useAuth';
import { isDesktopApp } from '../../lib/platform';
import { OPEN_API_KEY_MODAL_EVENT, type OpenApiKeyModalDetail } from '../../lib/apiKeyEvents';
import { syncRemoteUserProfile } from '../../lib/useUserProfile';
import { syncHistoryFromDb } from '../../lib/generatorHistory';
import { SyncNotice } from './SyncNotice';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isPopup = 
    (typeof window !== 'undefined' && window.name === 'BedrockOAuth') ||
    (typeof window !== 'undefined' && window.sessionStorage?.getItem('bedrock_auth_popup') === '1');

  useEffect(() => {
    if (isPopup) {
      try {
        if (window.opener) {
          window.opener.postMessage('clerk-auth-complete', '*');
        }
        localStorage.setItem('bedrock_auth_event', Date.now().toString());
        sessionStorage.removeItem('bedrock_auth_popup');
      } catch {}
      window.close();
      setTimeout(() => window.close(), 50);
      setTimeout(() => window.close(), 200);
    }
  }, [isPopup]);

  const [showKeyGateway, setShowKeyGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const [specificKeyModal, setSpecificKeyModal] = useState<{
    isOpen: boolean;
    modelId?: string;
    agentId?: string;
    modelName?: string;
  }>({ isOpen: false });

  const isDesktop = isDesktopApp();
  const navigate = useNavigate();

  // Background two-way synchronization for User Profile, Plan, and Prompts History
  useEffect(() => {
    const doSync = () => {
      syncRemoteUserProfile().catch(() => {});
      syncHistoryFromDb().catch(() => {});
    };

    doSync();
    window.addEventListener('focus', doSync);
    const interval = setInterval(doSync, 60000);

    return () => {
      window.removeEventListener('focus', doSync);
      clearInterval(interval);
    };
  }, []);

  if (isPopup) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505] text-sandstone-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
          <span className="text-sm font-mono">Authentication complete. Closing window...</span>
        </div>
      </div>
    );
  }

  // Desktop keyboard shortcuts: ⌘1 to ⌘6
  useEffect(() => {
    if (!isDesktop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        const keyMap: Record<string, string> = {
          '1': '/app',
          '2': '/app/generator',
          '3': '/app/branching',
          '4': '/app/tester',
          '5': '/app/library',
          '6': '/app/history',
        };
        if (keyMap[e.key]) {
          e.preventDefault();
          navigate(keyMap[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, navigate]);

  useEffect(() => {
    // Only enforce API key gateway modal automatically on Desktop App launch
    if (isDesktop) {
      const checkKeys = () => {
        const configured = hasApiKeysConfigured();
        if (!configured) {
          setShowKeyGateway(true);
        } else {
          setGatewayError(null);
        }
      };
      checkKeys();
      window.addEventListener('bedrock_api_keys_updated', checkKeys);
      window.addEventListener('storage', checkKeys);
      return () => {
        window.removeEventListener('bedrock_api_keys_updated', checkKeys);
        window.removeEventListener('storage', checkKeys);
      };
    }
  }, [isDesktop]);

  useEffect(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent<OpenApiKeyModalDetail>;
      if (customEvent.detail?.modelId || customEvent.detail?.agentId) {
        setSpecificKeyModal({
          isOpen: true,
          modelId: customEvent.detail.modelId,
          agentId: customEvent.detail.agentId,
          modelName: customEvent.detail.modelName,
        });
      } else {
        setGatewayError(customEvent.detail?.errorMessage || null);
        setManuallyOpened(true);
        setShowKeyGateway(true);
      }
    };

    window.addEventListener(OPEN_API_KEY_MODAL_EVENT, handleOpenModal);
    return () => {
      window.removeEventListener(OPEN_API_KEY_MODAL_EVENT, handleOpenModal);
    };
  }, []);

  return (
    <div className="bg-black text-white font-sans selection:bg-copper-500 selection:text-white relative">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-neutral-900/40 via-black/80 to-black pointer-events-none"></div>
      <div className="fixed inset-0 z-0 opacity-[0.05] pointer-events-none bg-[url('/noise.svg')] mix-blend-overlay"></div>

      {isDesktop ? (
        /* Desktop Application Layout: Sleek Left Sidebar + Full Height Workstation View */
        <div className="flex h-screen w-screen overflow-hidden relative z-10">
          <Sidebar onOpenKeyModal={() => {
            setGatewayError(null);
            setManuallyOpened(true);
            setShowKeyGateway(true);
          }} />
          <main className="flex-1 relative h-full overflow-y-auto min-w-0 bg-black custom-scrollbar">
            {children}
          </main>
        </div>
      ) : (
        /* Website Layout: Traditional Topbar + Scrolling Page */
        <div className="min-h-screen flex flex-col relative z-10">
          <Topbar />
          <main className="flex-1 relative pt-20">
            {children}
          </main>
        </div>
      )}

      <SyncNotice />

      {/* In-App API Key Gateway & Update Modal */}
      <ApiKeyGatewayModal
        isOpen={showKeyGateway}
        initialError={gatewayError}
        onSuccess={() => {
          setShowKeyGateway(false);
          setGatewayError(null);
          setManuallyOpened(false);
        }}
        canDismiss={manuallyOpened || hasApiKeysConfigured()}
      />

      {/* Targeted Model / Agent API Key Prompt Modal */}
      <ApiKeyPromptModal
        isOpen={specificKeyModal.isOpen}
        modelId={specificKeyModal.modelId}
        agentId={specificKeyModal.agentId}
        modelName={specificKeyModal.modelName}
        onClose={() => setSpecificKeyModal({ isOpen: false })}
        onKeySaved={() => setSpecificKeyModal({ isOpen: false })}
      />
    </div>
  );
}
