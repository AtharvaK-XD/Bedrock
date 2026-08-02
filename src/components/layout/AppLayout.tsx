import React from 'react';
import { Topbar } from './Topbar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sandstone-50 text-basalt-900 font-sans selection:bg-copper-500 selection:text-white flex flex-col">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white via-sandstone-50 to-sandstone-100 pointer-events-none"></div>
      <div className="fixed inset-0 z-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
      
      {/* Topbar */}
      <Topbar />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 pt-20">
        {children}
      </main>
    </div>
  );
}
