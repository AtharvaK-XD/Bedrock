import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COLORS, EASINGS, HIT_FRAMES } from './MotionTokens';

// ============================================================================
// ⚡ FLASH OVERLAY (FIX R7: Mint-white, Peak 60% luminance, 5-6 frames, soft decay)
// ============================================================================
interface FlashOverlayProps {
  triggerFrame: number;
  duration?: number;
}

export const FlashOverlay: React.FC<FlashOverlayProps> = ({ triggerFrame, duration = 6 }) => {
  const frame = useCurrentFrame();

  if (frame < triggerFrame || frame > triggerFrame + duration) return null;

  const age = frame - triggerFrame;
  // Peak at 60% luminance on frame 1, decay smoothly
  const flashOpacity = interpolate(age, [0, 1, duration], [0.35, 0.60, 0], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#d1fae5', // mint-white
        opacity: flashOpacity,
        zIndex: 90,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
};

// ============================================================================
// 🌟 W1 EDGE-LIGHT WIPE (6px mint streak + 80px glow, 18 frames)
// ============================================================================
interface EdgeLightWipeProps {
  startFrame: number;
  direction?: 'L2R' | 'R2L' | 'T2B' | 'B2T';
}

export const EdgeLightWipe: React.FC<EdgeLightWipeProps> = ({
  startFrame,
  direction = 'L2R',
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > startFrame + 18) return null;

  const progress = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
    easing: EASINGS.IN_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isHoriz = direction === 'L2R' || direction === 'R2L';
  const pos = direction === 'R2L' || direction === 'B2T' ? (1 - progress) * 100 : progress * 100;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 85,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          ...(isHoriz
            ? {
                left: `${pos}%`,
                top: 0,
                bottom: 0,
                width: '6px',
                transform: 'translateX(-50%)',
                background: '#ffffff',
                boxShadow: `0 0 40px ${COLORS.mint}, 0 0 80px ${COLORS.mint}`,
              }
            : {
                top: `${pos}%`,
                left: 0,
                right: 0,
                height: '6px',
                transform: 'translateY(-50%)',
                background: '#ffffff',
                boxShadow: `0 0 40px ${COLORS.mint}, 0 0 80px ${COLORS.mint}`,
              }),
        }}
      />
    </div>
  );
};

// ============================================================================
// 🥊 CAMERA RIG (Z1 Dolly always running, Z2 Punch-in + shake on hits, Dutch tilt)
// ============================================================================
interface CameraRigProps {
  children: React.ReactNode;
  sceneFrame: number;
  sceneDuration: number;
  globalFrame: number;
  dutchTilt?: boolean;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  sceneFrame,
  sceneDuration,
  globalFrame,
  dutchTilt = false,
}) => {
  // Z1: Slow Dolly scale 1.00 -> 1.07 continuously running
  const dollyScale = interpolate(sceneFrame, [0, sceneDuration], [1.00, 1.07], {
    easing: EASINGS.IN_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Z2: Punch-in on the 5 audio hits (1.00 -> 1.10 in 4 frames, return in 14 frames, 3-4px shake)
  let hitScale = 1.0;
  let shakeX = 0;
  let shakeY = 0;

  Object.values(HIT_FRAMES).forEach((hit) => {
    if (globalFrame >= hit && globalFrame <= hit + 18) {
      const age = globalFrame - hit;
      const punch = interpolate(age, [0, 4, 18], [1.0, 1.10, 1.0], {
        easing: EASINGS.BACK_OUT,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      hitScale = Math.max(hitScale, punch);

      if (age <= 10) {
        shakeX = (Math.sin(age * 3.5) * 4) * (1 - age / 10);
        shakeY = (Math.cos(age * 4.2) * 3) * (1 - age / 10);
      }
    }
  });

  // Dutch tilt (1.5 deg for scene 1-2, straightening)
  const tiltDeg = dutchTilt
    ? interpolate(sceneFrame, [0, sceneDuration], [1.5, 0.2], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const totalScale = dollyScale * hitScale;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${totalScale}) translate(${shakeX}px, ${shakeY}px) rotate(${tiltDeg}deg)`,
        transformOrigin: '960px 540px',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
};
