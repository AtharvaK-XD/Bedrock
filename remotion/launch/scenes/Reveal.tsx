import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { LogoAssembly } from '../components/Logo';
import { Flash, LightSweep, Particles, Rays, Shake, Shockwave } from '../components/Fx';
import { WordReveal } from '../components/Text';
import { Plate } from '../components/Plate';
import { CLIPS } from '../clips';
import { C, EASE, FONT, tween } from '../theme';
import { SCENES, sceneCues } from '../timeline';
import { REVEAL_IMPACT } from '../beats';

// ============================================================================
// 02 — THE REVEAL
// Shards from the broken frame converge into the real Bedrock logo on the word
// "Bedrock", then the site's hero line lands word-by-word with the voice.
// ============================================================================

const WORDMARK = 'Bedrock';

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const c = sceneCues('reveal');
  const impact = REVEAL_IMPACT - SCENES.reveal.from;
  const travel = Math.max(24, Math.min(50, impact - 14));
  const hero = c.at('Intelligence', 0.45);
  const heroWords = c.words('Intelligence, shaped by you.', 0.45);
  const exit = c.dur - 22;

  const lift = tween(frame, [hero - 16, hero + 14], [0, 1], EASE.inOut);
  const zoomOut = tween(frame, [exit, c.dur], [0, 1], EASE.inExpo);
  const rays = tween(frame, [impact - 4, impact + 10]) * (1 - lift * 0.6);

  return (
    <AbsoluteFill>
      <Backdrop glow={tween(frame, [impact - 10, impact + 20], [0.15, 1])} />
      <Plate src={CLIPS.reveal} opacity={tween(frame, [0, 30]) * 0.9} />
      <Particles count={80} seed={7} opacity={tween(frame, [0, 40])} speed={1.4} />

      <Shake hits={[impact]} intensity={14} dur={22}>
        <AbsoluteFill
          style={{
            transform: `scale(${1 + zoomOut * 0.9})`,
            filter: `blur(${zoomOut * 14}px)`,
            opacity: 1 - zoomOut,
          }}
        >
          <Rays x={960} y={430 - lift * 210} opacity={rays} />

          {/* logo: assembles, then lifts into a lockup above the hero line */}
          <div
            style={{
              position: 'absolute',
              left: 960 - 170,
              top: 430 - 170,
              width: 340,
              height: 340,
              transform: `translateY(${-lift * 250}px) scale(${1 - lift * 0.52})`,
            }}
          >
            <LogoAssembly at={impact} size={340} travel={travel} />
          </div>

          {/* wordmark */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 640,
              display: 'flex',
              justifyContent: 'center',
              fontFamily: FONT.display,
              fontWeight: 700,
              fontSize: 132,
              color: C.text,
              opacity: 1 - lift,
              transform: `translateY(${-lift * 60}px)`,
            }}
          >
            {WORDMARK.split('').map((ch, i) => {
              const p = tween(frame, [impact + 4 + i * 2, impact + 30 + i * 2], [0, 1], EASE.outExpo);
              return (
                <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: '0 0.01em' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      transform: `translateY(${(1 - p) * 100}%)`,
                      letterSpacing: `${(1 - p) * 0.3 - 0.02}em`,
                    }}
                  >
                    {ch}
                  </span>
                </span>
              );
            })}
          </div>

          {/* hero line from the Bedrock site */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 430, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <WordReveal
              text="Intelligence,"
              timings={heroWords.slice(0, 1)}
              dur={30}
              style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 168, lineHeight: 0.98, letterSpacing: '-0.035em', color: C.text }}
            />
            <WordReveal
              text="shaped by you."
              timings={heroWords.slice(1)}
              dur={30}
              style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 168, lineHeight: 0.98, letterSpacing: '-0.035em', color: C.heroGray }}
              wordStyle={(i) => (i === 2 ? { color: C.tealLight } : {})}
            />
            <div
              style={{
                marginTop: 34,
                height: 4,
                borderRadius: 2,
                width: 520 * tween(frame, [heroWords[3] ?? hero + 40, (heroWords[3] ?? hero + 40) + 30], [0, 1], EASE.outExpo),
                background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`,
                boxShadow: `0 0 20px ${C.teal}`,
              }}
            />
          </div>

          <Shockwave at={impact} x={960} y={430} maxR={1100} />
        </AbsoluteFill>
      </Shake>

      <Flash at={impact} strength={0.75} dur={20} />
      <LightSweep at={exit - 6} dur={30} />
    </AbsoluteFill>
  );
};
