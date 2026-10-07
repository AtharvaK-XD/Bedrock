import React from 'react';
import { Img, staticFile } from 'remotion';

interface BrowserMockupProps {
  imageSrc: string;
  url: string;
  rotateX?: number;
  rotateY?: number;
  scale?: number;
  glowColor?: string;
  panY?: number;
}

export const BrowserMockup: React.FC<BrowserMockupProps> = ({
  imageSrc,
  url,
  rotateX = 0,
  rotateY = 0,
  scale = 1,
  glowColor = 'rgba(200, 168, 107, 0.3)',
  panY = 0,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        width: '1280px',
        height: '760px',
        transform: `scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
        borderRadius: '20px',
        backgroundColor: '#0b0e15',
        border: '1.5px solid rgba(200, 168, 107, 0.35)',
        boxShadow: `0 40px 100px -15px rgba(0, 0, 0, 0.95), 0 0 50px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Workstation Titlebar */}
      <div
        style={{
          height: '44px',
          backgroundColor: 'rgba(11, 14, 21, 0.95)',
          borderBottom: '1px solid rgba(200, 168, 107, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 20,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Window Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444', opacity: 0.8 }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b', opacity: 0.8 }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981', opacity: 0.8 }} />
        </div>

        {/* Omnibar URL Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 20px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(200, 168, 107, 0.2)',
            fontSize: '11px',
            color: '#c8a86b',
            letterSpacing: '0.05em',
            fontFamily: "'Space Grotesk', monospace",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{url}</span>
        </div>

        {/* Live Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span>BEDROCK KERNEL v1.2.2</span>
        </div>
      </div>

      {/* Real Website/App Viewport */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          backgroundColor: '#06080d',
        }}
      >
        <Img
          src={staticFile(imageSrc)}
          style={{
            width: '100%',
            height: 'auto',
            transform: `translateY(${panY}px)`,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};
