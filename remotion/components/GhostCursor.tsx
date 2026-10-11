import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COLORS, EASINGS } from './MotionTokens';

export interface CursorWaypoint {
  frame: number;
  x: number;
  y: number;
  isClick?: boolean;
  isDrag?: boolean;
}

interface GhostCursorProps {
  sceneFrame: number;
  waypoints: CursorWaypoint[];
  visible?: boolean;
}

export const GhostCursor: React.FC<GhostCursorProps> = ({
  sceneFrame,
  waypoints,
  visible = true,
}) => {
  if (!visible || waypoints.length === 0) return null;

  // Find surrounding waypoints
  let prev = waypoints[0];
  let next = waypoints[waypoints.length - 1];

  for (let i = 0; i < waypoints.length - 1; i++) {
    if (sceneFrame >= waypoints[i].frame && sceneFrame <= waypoints[i + 1].frame) {
      prev = waypoints[i];
      next = waypoints[i + 1];
      break;
    }
  }

  // Calculate current interpolated position
  const range = Math.max(1, next.frame - prev.frame);
  const factor = Math.min(1, Math.max(0, (sceneFrame - prev.frame) / range));
  const easedFactor = EASINGS.IN_OUT(factor);

  const curX = prev.x + (next.x - prev.x) * easedFactor;
  const curY = prev.y + (next.y - prev.y) * easedFactor;

  // Check if current frame triggers a click ripple
  const activeClick = waypoints.find(
    (wp) => wp.isClick && sceneFrame >= wp.frame && sceneFrame <= wp.frame + 24
  );

  const clickAge = activeClick ? sceneFrame - activeClick.frame : 999;
  const rippleScale = interpolate(clickAge, [0, 24], [1, 2.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rippleOpacity = interpolate(clickAge, [0, 24], [0.65, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isPressed = clickAge >= 0 && clickAge <= 5;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${curX}px`,
        top: `${curY}px`,
        transform: `translate(-4px, -4px) scale(${isPressed ? 0.94 : 1.0})`,
        zIndex: 60,
        pointerEvents: 'none',
        transition: 'transform 0.08s ease',
      }}
    >
      {/* Click Ripple Wave Ring */}
      {clickAge >= 0 && clickAge <= 24 && (
        <div
          style={{
            position: 'absolute',
            left: '4px',
            top: '4px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: `2px solid ${COLORS.mint}`,
            boxShadow: '0 0 14px rgba(16, 185, 129, 0.7)',
            transform: `translate(-50%, -50%) scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* SVG 28px Ghost Cursor Arrow */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 8px rgba(16, 185, 129, 0.35))',
        }}
      >
        <path
          d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
          fill="rgba(255, 255, 255, 0.95)"
          stroke="#05080a"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
