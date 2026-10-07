import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar } from './Topbar';
import { ApiKeyGatewayModal } from '../auth/ApiKeyGatewayModal';
import { hasApiKeysConfigured } from '../../lib/useAuth';
import { isDesktopApp } from '../../lib/platform';
import { OPEN_API_KEY_MODAL_EVENT, type OpenApiKeyModalDetail } from '../../lib/apiKeyEvents';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [showKeyGateway, setShowKeyGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const isDesktop = isDesktopApp();
  const navigate = useNavigate();

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
      setGatewayError(customEvent.detail?.errorMessage || null);
      setManuallyOpened(true);
      setShowKeyGateway(true);
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
      <div className="fixed inset-0 z-0 opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

      {isDesktop ? (
        /* Desktop Application Layout: Full Height Workstation View with Floating Animated Topbar */
        <div className="h-screen w-screen overflow-hidden flex flex-col relative z-10">
          <Topbar />
          <main className="flex-1 relative pt-20 overflow-y-auto min-w-0 bg-black custom-scrollbar">
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
    </div>
  );
}
