import React from 'react';
import { Img, staticFile } from 'remotion';

interface BrowserMockupProps {
  imageSrc: string;
  url: string;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  glowColor?: string;
  panY?: number;
  width?: number;
  height?: number;
  sheenOffset?: number; // 0 to 100 for specular sheen position
  cursorX?: number; // percentage 0 to 100
  cursorY?: number; // percentage 0 to 100
  cursorClick?: boolean;
}

export const BrowserMockup: React.FC<BrowserMockupProps> = ({
  imageSrc,
  url,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  glowColor = 'rgba(16, 185, 129, 0.35)',
  panY = 0,
  width = 1280,
  height = 760,
  sheenOffset,
  cursorX,
  cursorY,
  cursorClick = false,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
        transformStyle: 'preserve-3d',
        borderRadius: '20px',
        backgroundColor: '#070a0f',
        border: '1.5px solid rgba(16, 185, 129, 0.38)',
        boxShadow: `0 40px 100px -15px rgba(0, 0, 0, 0.95), 0 0 60px ${glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.18)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Specular Light Reflection Sweep */}
      {sheenOffset !== undefined && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(115deg, transparent ${sheenOffset - 15}%, rgba(255, 255, 255, 0.08) ${sheenOffset}%, rgba(16, 185, 129, 0.15) ${sheenOffset + 5}%, transparent ${sheenOffset + 20}%)`,
            pointerEvents: 'none',
            zIndex: 35,
          }}
        />
      )}

      {/* Workstation Titlebar */}
      <div
        style={{
          height: '44px',
          backgroundColor: 'rgba(9, 13, 19, 0.95)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.22)',
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
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444', opacity: 0.85 }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b', opacity: 0.85 }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981', opacity: 0.85, boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)' }} />
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
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '11px',
            color: '#34d399',
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

        {/* Dynamic Simulated Precision Cursor */}
        {cursorX !== undefined && cursorY !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: `${cursorX}%`,
              top: `${cursorY}%`,
              transform: `translate(-2px, -2px) scale(${cursorClick ? 0.85 : 1})`,
              transition: 'transform 0.1s ease',
              zIndex: 30,
              pointerEvents: 'none',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.8))',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <polygon points="3,3 10,21 13,13 21,10" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
            {cursorClick && (
              <div
                style={{
                  position: 'absolute',
                  left: '0px',
                  top: '0px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid #34d399',
                  animation: 'none',
                  transform: 'translate(-8px, -8px)',
                  boxShadow: '0 0 12px #34d399',
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
