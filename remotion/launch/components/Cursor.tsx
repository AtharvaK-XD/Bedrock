import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { C, EASE, tealA, tween } from '../theme';

export interface Waypoint {
  f: number;
  x: number;
  y: number;
  click?: boolean;
}

/** Ghost cursor that glides between waypoints and clicks with a ripple. */
export const Cursor: React.FC<{ path: Waypoint[]; showAt?: number; hideAt?: number }> = ({ path, showAt, hideAt }) => {
  const frame = useCurrentFrame();
  const first = path[0];
  const last = path[path.length - 1];
  const appear = showAt ?? first.f - 10;
  const vanish = hideAt ?? last.f + 40;
  if (frame < appear - 1 || frame > vanish + 12) return null;

  let x = first.x;
  let y = first.y;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (frame >= a.f && frame <= b.f) {
      const p = interpolate(frame, [a.f, b.f], [0, 1], { easing: EASE.inOut });
      x = a.x + (b.x - a.x) * p;
      y = a.y + (b.y - a.y) * p;
      // gentle arc so movement never looks robotic
      y -= Math.sin(p * Math.PI) * Math.min(60, Math.abs(b.x - a.x) * 0.08);
    }
  }
  if (frame > last.f) {
    x = last.x;
    y = last.y;
  }

  const click = path.find((w) => w.click && frame >= w.f && frame < w.f + 26);
  const press = click ? 1 - Math.sin(tween(frame, [click.f, click.f + 10], [0, Math.PI], (t) => t)) * 0.18 : 1;
  const ring = click ? tween(frame, [click.f, click.f + 24], [0, 1], EASE.outQuart) : 0;
  const opacity = tween(frame, [appear, appear + 10]) * tween(frame, [vanish, vanish + 12], [1, 0]);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${x}px, ${y}px)`, opacity, zIndex: 50, pointerEvents: 'none' }}>
      {click && (
        <div
          style={{
            position: 'absolute',
            left: -6 - ring * 34,
            top: -6 - ring * 34,
            width: 12 + ring * 68,
            height: 12 + ring * 68,
            borderRadius: '50%',
            border: `2px solid ${C.tealLight}`,
            opacity: 1 - ring,
            boxShadow: `0 0 24px ${tealA(0.6)}`,
          }}
        />
      )}
      <svg
        width={34}
        height={34}
        viewBox="0 0 24 24"
        style={{ transform: `scale(${press})`, transformOrigin: '2px 2px', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6))' }}
      >
        <path d="M3 2.2 L3 19.4 L7.6 15.2 L10.6 21.6 L13.6 20.3 L10.7 14 L16.9 14 Z" fill="#ffffff" stroke="#0b0d0e" strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
