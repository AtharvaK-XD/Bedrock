import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, random } from 'remotion';
import { COLORS, HIT_FRAMES } from './MotionTokens';

export const GlobalAtmosphere: React.FC = () => {
  const frame = useCurrentFrame();

  // 40 small + 12 large dust particles with 2 depth layers
  const smallParticles = new Array(40).fill(0).map((_, i) => {
    const size = random(`s-size-${i}`) * 2 + 1.5;
    const startX = random(`s-x-${i}`) * 100;
    const startY = random(`s-y-${i}`) * 120;
    const speed = random(`s-spd-${i}`) * 0.08 + 0.04;
    const yPos = ((startY - frame * speed) % 120 + 120) % 120 - 10;
    const sway = Math.sin(frame * 0.015 + random(`s-sw-${i}`) * Math.PI * 2) * 1.5;

    return (
      <div
        key={`sp-${i}`}
        style={{
          position: 'absolute',
          left: `${startX + sway}%`,
          top: `${yPos}%`,
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          borderRadius: '50%',
          filter: 'blur(1px)',
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />
    );
  });

  const largeParticles = new Array(12).fill(0).map((_, i) => {
    const size = random(`l-size-${i}`) * 5 + 4;
    const startX = random(`l-x-${i}`) * 100;
    const startY = random(`l-y-${i}`) * 120;
    const speed = random(`l-spd-${i}`) * 0.14 + 0.08;
    const yPos = ((startY - frame * speed) % 120 + 120) % 120 - 10;
    const sway = Math.sin(frame * 0.01 + random(`l-sw-${i}`) * Math.PI * 2) * 3;

    return (
      <div
        key={`lp-${i}`}
        style={{
          position: 'absolute',
          left: `${startX + sway}%`,
          top: `${yPos}%`,
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: 'rgba(16, 185, 129, 0.4)',
          borderRadius: '50%',
          filter: 'blur(5px)',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />
    );
  });

  // Audio-reactive rim / beam pulse on hit frames (pulses +8% for 120ms = ~7 frames)
  let hitPulse = 0;
  Object.values(HIT_FRAMES).forEach((hit) => {
    if (frame >= hit && frame <= hit + 14) {
      hitPulse = Math.max(
        hitPulse,
        interpolate(frame, [hit, hit + 4, hit + 14], [0, 0.12, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      );
    }
  });

  return (
    <AbsoluteFill style={{ zIndex: 0, pointerEvents: 'none', backgroundColor: COLORS.bg }}>
      {/* 6.1 Base Grade & Lifted Blacks (~#05080A, cool-green shadows) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 45%, #091214 0%, #05080a 75%, #020405 100%)',
        }}
      />

      {/* Volumetric Key Light Beam from top (10-14% opacity) */}
      <div
        style={{
          position: 'absolute',
          top: '-25%',
          left: '15%',
          width: '70%',
          height: '130%',
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.14) 0%, rgba(255, 255, 255, 0.04) 40%, transparent 100%)',
          filter: 'blur(75px)',
          transform: `rotate(${interpolate(frame, [0, 3600], [-12, 12])}deg)`,
          transformOrigin: 'top center',
          opacity: 0.9 + hitPulse,
        }}
      />

      {/* Secondary Left Beam */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '45%',
          height: '110%',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, transparent 80%)',
          filter: 'blur(90px)',
          transform: 'rotate(25deg)',
          transformOrigin: 'top left',
        }}
      />

      {/* Secondary Right Beam */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '45%',
          height: '110%',
          background: 'linear-gradient(225deg, rgba(16, 185, 129, 0.06) 0%, transparent 80%)',
          filter: 'blur(90px)',
          transform: 'rotate(-25deg)',
          transformOrigin: 'top right',
        }}
      />

      {/* Subtle Grid with gentle vertical drift */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          transform: `translateY(${frame * 0.15}px)`,
          opacity: 0.45,
        }}
      />

      {/* Floor reflection plane under card groups (6% opacity) */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '10%',
          right: '10%',
          height: '240px',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
          filter: 'blur(45px)',
          pointerEvents: 'none',
        }}
      />

      {/* Dust Particles */}
      {smallParticles}
      {largeParticles}
    </AbsoluteFill>
  );
};
