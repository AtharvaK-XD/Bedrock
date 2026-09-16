import React from 'react';
import { BorderBeam } from 'border-beam';
import { cn } from '../../lib/utils';

interface WavyBorderBeamProps {
  children: React.ReactNode;
  className?: string;
  borderRadius?: number;
}

export function WavyBorderBeam({
  children,
  className,
  borderRadius = 24,
}: WavyBorderBeamProps) {
  return (
    <div className={cn("relative group w-full", className)}>
      {/* 1. Deep Atmospheric Outer Aurora Bloom (Extends wide around the card) */}
      <div 
        className="pointer-events-none absolute -inset-3 sm:-inset-5 rounded-[36px] opacity-75 sm:opacity-85 mix-blend-screen transition-opacity duration-700 blur-[36px] sm:blur-[50px] overflow-hidden -z-10"
        aria-hidden="true"
      >
        <div 
          className="w-full h-full animate-[wavy-aurora-spin_10s_linear_infinite]"
          style={{
            background: `conic-gradient(
              from 0deg at 50% 50%,
              rgba(34, 211, 238, 0.75) 0deg,
              rgba(244, 63, 94, 0.8) 75deg,
              rgba(168, 85, 247, 0.85) 150deg,
              rgba(59, 130, 246, 0.8) 225deg,
              rgba(16, 185, 129, 0.7) 300deg,
              rgba(34, 211, 238, 0.75) 360deg
            )`
          }}
        />
      </div>

      {/* 2. Secondary Wavy Ambient Pulse (Softly undulates to create the wavy motion) */}
      <div 
        className="pointer-events-none absolute -inset-1 sm:-inset-2 rounded-[30px] opacity-60 mix-blend-color-dodge blur-[20px] sm:blur-[28px] animate-[wavy-aurora-breathe_6s_ease-in-out_infinite] -z-10"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 75% 60% at 50% 20%, rgba(244, 63, 94, 0.6) 0%, rgba(34, 211, 238, 0.5) 40%, rgba(168, 85, 247, 0.5) 75%, transparent 100%)`
        }}
      />

      {/* 3. Primary Core BorderBeam from libraries.dev (Travelling edge light) */}
      <BorderBeam
        size="md"
        colorVariant="colorful"
        borderRadius={borderRadius}
        strength={1}
        brightness={1.6}
        saturation={1.4}
        className="rounded-3xl relative"
        style={{
          '--beam-bloom-opacity': 3.2,
          '--beam-inner-opacity': 2.8,
        } as React.CSSProperties}
      >
        {/* Inner atmospheric wash: diffuses light softly across the top of the card */}
        <div className="relative w-full h-full rounded-3xl overflow-visible">
          <div 
            className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-3xl opacity-30 mix-blend-screen bg-gradient-to-b from-rose-500/25 via-cyan-500/15 to-transparent z-10 animate-[wavy-inner-pulse_5s_ease-in-out_infinite]"
            aria-hidden="true"
          />
          {children}
        </div>
      </BorderBeam>
    </div>
  );
}
