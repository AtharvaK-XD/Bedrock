import React, { type CSSProperties } from 'react';
import { Img, staticFile } from 'remotion';
import { C, FONT, tealA } from '../theme';

export type NavTab = 'Dashboard' | 'Generator' | 'Branching' | 'Prompt Tester' | 'Library' | 'History';
const TABS: NavTab[] = ['Dashboard', 'Generator', 'Branching', 'Prompt Tester', 'Library', 'History'];

/** Recreation of the Bedrock app top bar (see public/screenshots/03-05). */
export const NavBar: React.FC<{ active: NavTab; scale?: number }> = ({ active, scale = 1 }) => (
  <div
    style={{
      height: 64 * scale,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${22 * scale}px`,
      borderBottom: `1px solid ${C.line}`,
      fontFamily: FONT.sans,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 * scale }}>
      <Img src={staticFile('logo-tight.png')} style={{ width: 26 * scale, height: 'auto' }} />
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 19 * scale, color: C.text, letterSpacing: '-0.01em' }}>Bedrock</span>
    </div>
    <div
      style={{
        display: 'flex',
        gap: 2 * scale,
        padding: 4 * scale,
        borderRadius: 14 * scale,
        border: `1px solid ${C.line}`,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {TABS.map((t) => (
        <div
          key={t}
          style={{
            padding: `${7 * scale}px ${14 * scale}px`,
            borderRadius: 10 * scale,
            fontSize: 14 * scale,
            fontWeight: t === active ? 600 : 400,
            color: t === active ? C.text : 'rgba(232,240,238,0.55)',
            background: t === active ? 'rgba(255,255,255,0.09)' : 'transparent',
          }}
        >
          {t}
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 * scale }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6 * scale,
          padding: `${5 * scale}px ${10 * scale}px`,
          borderRadius: 8 * scale,
          border: `1px solid ${tealA(0.4)}`,
          background: tealA(0.1),
          fontFamily: FONT.mono,
          fontSize: 12 * scale,
          color: C.tealLight,
        }}
      >
        <span style={{ width: 6 * scale, height: 6 * scale, borderRadius: '50%', background: C.tealLight }} />
        Keys Active
      </div>
      <div
        style={{
          width: 30 * scale,
          height: 30 * scale,
          borderRadius: '50%',
          background: C.teal,
          color: '#fff',
          fontSize: 12 * scale,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        PA
      </div>
    </div>
  </div>
);

/** Glass desktop window that hosts a recreated Bedrock workspace. */
export const AppWindow: React.FC<{
  width: number;
  height: number;
  active: NavTab;
  children: React.ReactNode;
  style?: CSSProperties;
  glow?: number;
}> = ({ width, height, active, children, style, glow = 1 }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 24,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #0b0e0f 0%, #060808 100%)',
      border: `1px solid ${C.lineStrong}`,
      boxShadow: `0 60px 140px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 ${90 * glow}px ${tealA(0.16 * glow)}`,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  >
    <NavBar active={active} />
    <div style={{ position: 'relative', flex: 1 }}>{children}</div>
  </div>
);
