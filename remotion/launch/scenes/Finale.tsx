import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { LogoMark } from '../components/Logo';
import { WordReveal } from '../components/Text';
import { Flash, Particles, Rays, Shake, Shockwave } from '../components/Fx';
import { Plate } from '../components/Plate';
import { CLIPS } from '../clips';
import { C, EASE, FONT, SPRING, springAt, tealA, tween } from '../theme';
import { sceneCues } from '../timeline';

// ============================================================================
// 07 — FINALE
// "Stop guessing with LLMs. / Start engineering." exactly as styled on the
// Bedrock site, then the logo slam and the download end card.
// Version comes from package.json (1.3.3); URL is the live site.
// ============================================================================

const VERSION = '1.3.3';
const SITE = 'bedrock-steel.vercel.app';

const WindowsIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 88 88" fill={color}>
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.202L0 12.402zm35.67 33.529l.028 34.453L.028 75.48l-.02-29.347 35.662-.202zm4.326-39.043L87.914 0v41.526l-47.918.378V6.888zm47.918 38.647L88 87.999l-47.962-6.791-.038-34.195 48.002.046z" />
  </svg>
);

const AppleIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 -4 170 174" fill={color}>
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.73-14.19-5.99-9.35-10.74-20.2-14.25-32.55-3.51-12.35-5.27-24.08-5.27-35.18 0-14.68 3.73-26.68 11.19-36 7.46-9.31 16.73-14.07 27.81-14.27 4.9 0 10.42 1.25 16.56 3.75 6.14 2.5 10.15 3.79 12.04 3.86 1.48 0 5.66-1.39 12.56-4.16 6.9-2.78 12.7-3.95 17.4-3.52 13.51 1.07 24.16 6.36 31.95 15.86-11.97 7.24-17.84 17.3-17.62 30.17.21 10.22 4.1 18.73 11.66 25.53 7.56 6.8 16.64 10.59 27.24 11.37-2.58 8.04-5.83 16.14-9.76 24.31zM119.22 31.84c0-7.39 2.66-14.28 7.97-20.67 5.32-6.39 11.83-10.45 19.55-12.17.64 1.71.96 3.42.96 5.13 0 7.39-2.77 14.33-8.31 20.84-5.54 6.5-12.18 10.4-19.92 11.7-.1-.95-.25-2.57-.25-4.83z" />
  </svg>
);

export const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const c = sceneCues('cta');
  const stopWords = c.words('Stop guessing with LLMs.', 0);
  const startWords = c.words('Start engineering.', 0.3);
  const slam = c.at('Bedrock', 0.55);
  const download = c.at('Download free', 0.7);
  const end = c.dur;

  const linesOut = tween(frame, [slam - 14, slam], [0, 1], EASE.inExpo);
  const logoIn = springAt(frame, slam, SPRING.heavy);
  const lockup = tween(frame, [download - 18, download + 10], [0, 1], EASE.inOut);
  const cardIn = (d: number) => springAt(frame, download + d, SPRING.ui);
  const fadeOut = tween(frame, [end - 16, end], [0, 1], EASE.inOut);
  const underline = tween(frame, [startWords[1] ?? startWords[0] + 12, (startWords[1] ?? startWords[0] + 12) + 24], [0, 1], EASE.outExpo);

  return (
    <AbsoluteFill style={{ opacity: 1 - fadeOut }}>
      <Backdrop glow={tween(frame, [slam - 4, slam + 20], [0.5, 1.1])} grid={0} />
      <Plate src={CLIPS.finale} opacity={tween(frame, [slam, slam + 30]) * 0.85} />
      <Particles count={90} seed={91} opacity={tween(frame, [slam, slam + 30], [0.3, 1])} speed={0.8} />

      <Shake hits={[startWords[0], slam]} intensity={12} dur={20}>
        {/* the statement */}
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            transform: `scale(${1 - linesOut * 0.5})`,
            filter: `blur(${linesOut * 16}px)`,
            opacity: 1 - linesOut,
          }}
        >
          <WordReveal
            text="Stop guessing with LLMs."
            timings={stopWords}
            dur={24}
            style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 122, letterSpacing: '-0.035em', color: C.text, justifyContent: 'center' }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: FONT.serif,
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: 150,
                letterSpacing: '-0.01em',
                color: C.teal,
                filter: 'blur(26px)',
                opacity: 0.55 * tween(frame, [startWords[0], startWords[0] + 20]),
              }}
            >
              Start engineering.
            </div>
            <WordReveal
              text="Start engineering."
              timings={startWords}
              dur={20}
              style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 150, letterSpacing: '-0.01em', justifyContent: 'center' }}
              wordStyle={() => ({
                color: C.teal,
                backgroundImage: `linear-gradient(180deg, ${C.tealLight} 0%, ${C.teal} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              })}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -6,
                height: 5,
                width: 760 * underline,
                transform: 'translateX(-50%)',
                borderRadius: 3,
                background: `linear-gradient(90deg, transparent, ${C.teal}, ${C.tealLight}, ${C.teal}, transparent)`,
                boxShadow: `0 0 24px ${C.teal}`,
              }}
            />
          </div>
        </AbsoluteFill>

        {/* logo slam → lockup */}
        {frame >= slam - 2 && (
          <AbsoluteFill>
            <Rays x={960} y={420 - lockup * 150} opacity={tween(frame, [slam, slam + 12]) * (0.9 - lockup * 0.4)} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 230 - lockup * 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 34 * logoIn,
                transform: `scale(${(2.4 - logoIn * 1.4) * (1 - lockup * 0.28)})`,
                opacity: Math.min(1, logoIn * 2),
              }}
            >
              <LogoMark size={300} halo={0.55} />
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 168,
                  letterSpacing: '-0.03em',
                  color: C.text,
                  overflow: 'hidden',
                  maxWidth: 760 * tween(frame, [slam + 6, slam + 30], [0, 1], EASE.outExpo),
                  whiteSpace: 'nowrap',
                }}
              >
                Bedrock
              </div>
            </div>
          </AbsoluteFill>
        )}

        {/* end card */}
        {frame >= download - 20 && (
          <AbsoluteFill>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 492,
                textAlign: 'center',
                fontFamily: FONT.display,
                fontWeight: 500,
                fontSize: 46,
                letterSpacing: '-0.02em',
                color: C.text,
                opacity: cardIn(-12),
                transform: `translateY(${(1 - cardIn(-12)) * 30}px)`,
              }}
            >
              Intelligence, <span style={{ color: C.heroGray }}>shaped by you.</span>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 600, display: 'flex', justifyContent: 'center', gap: 22 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '22px 40px',
                  borderRadius: 999,
                  background: '#ffffff',
                  color: '#000',
                  fontFamily: FONT.sans,
                  fontWeight: 600,
                  fontSize: 26,
                  boxShadow: `0 0 40px rgba(255,255,255,0.15), 0 0 80px ${tealA(0.25)}`,
                  opacity: cardIn(0),
                  transform: `translateY(${(1 - cardIn(0)) * 40}px) scale(${0.9 + cardIn(0) * 0.1})`,
                }}
              >
                <WindowsIcon size={24} color="#000" />
                Download for Windows
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '22px 40px',
                  borderRadius: 999,
                  border: `1px solid ${C.lineStrong}`,
                  background: 'rgba(255,255,255,0.05)',
                  color: C.text,
                  fontFamily: FONT.sans,
                  fontWeight: 600,
                  fontSize: 26,
                  opacity: cardIn(5),
                  transform: `translateY(${(1 - cardIn(5)) * 40}px) scale(${0.9 + cardIn(5) * 0.1})`,
                }}
              >
                <AppleIcon size={26} color={C.text} />
                Download for Mac
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 730,
                display: 'flex',
                justifyContent: 'center',
                gap: 26,
                fontFamily: FONT.mono,
                fontSize: 22,
                letterSpacing: '0.06em',
                opacity: cardIn(12),
              }}
            >
              <span style={{ color: C.tealLight }}>{SITE}</span>
              <span style={{ color: C.dim }}>·</span>
              <span style={{ color: C.muted }}>v{VERSION} · Windows & macOS</span>
            </div>
          </AbsoluteFill>
        )}

        <Shockwave at={slam} x={960} y={380} maxR={1300} />
      </Shake>

      <Flash at={startWords[0]} strength={0.25} dur={12} />
      <Flash at={slam} strength={0.8} dur={22} />
    </AbsoluteFill>
  );
};
