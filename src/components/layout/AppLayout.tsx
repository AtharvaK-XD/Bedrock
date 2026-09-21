import React, { useState, useEffect } from 'react';
import { Topbar } from './Topbar';
import { ApiKeyGatewayModal } from '../auth/ApiKeyGatewayModal';
import { hasApiKeysConfigured } from '../../lib/useAuth';
import { isDesktopApp } from '../../lib/platform';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [showKeyGateway, setShowKeyGateway] = useState(false);
  const isDesktop = isDesktopApp();

  useEffect(() => {
    // Only enforce API key gateway modal on Desktop App
    if (!isDesktop) {
      setShowKeyGateway(false);
      return;
    }

    const checkKeys = () => {
      setShowKeyGateway(!hasApiKeysConfigured());
    };
    checkKeys();
    window.addEventListener('bedrock_api_keys_updated', checkKeys);
    window.addEventListener('storage', checkKeys);
    return () => {
      window.removeEventListener('bedrock_api_keys_updated', checkKeys);
      window.removeEventListener('storage', checkKeys);
    };
  }, [isDesktop]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-copper-500 selection:text-white flex flex-col">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-neutral-900/40 via-black/80 to-black pointer-events-none"></div>
      <div className="fixed inset-0 z-0 opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
      
      <Topbar />

      {/* Main Content Area */}
      <main className="flex-1 relative pt-20">
        {children}
      </main>

      {/* First-Open Onboarding API Key Gateway Modal (Desktop App Only) */}
      {isDesktop && (
        <ApiKeyGatewayModal
          isOpen={showKeyGateway}
          onSuccess={() => setShowKeyGateway(false)}
          canDismiss={false}
        />
      )}
    </div>
  );
}
