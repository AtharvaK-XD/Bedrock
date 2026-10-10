import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

const GLYPHS = '01#@$%&*<>[]{}~=+/ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getScrambledText(targetText: string, progress: number, seed: number): string {
  const chars = targetText.split('');
  const lockIndex = Math.floor(chars.length * progress);

  return chars
    .map((char, i) => {
      if (char === ' ' || char === '·' || char === ':' || char === '[' || char === ']' || char === '✓' || char === '❌') return char;
      if (i < lockIndex) return char;
      const glyphIndex = Math.abs((seed * 37 + i * 17) % GLYPHS.length);
      return GLYPHS[glyphIndex];
    })
    .join('');
}

export const Scene1ProblemAndGenesis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Depth of field cue on transitions
  const bgBlur = interpolate(frame, [0, 15, 430, 450], [12, 0, 0, 12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sceneOpacity = interpolate(frame, [0, 15, 430, 450], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const diveZoom = interpolate(frame, [410, 450], [1, 1.8], { easing: Easing.bezier(0.7, 0, 0.84, 0), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ==========================
  // PHASE 1: CHAOS (0 - 165)
  // ==========================
  const title1Words = "AI development is broken.".split(" ");
  
  const p1CardSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 14, stiffness: 90 } });
  const p1CardBlur = interpolate(p1CardSpring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  const p1CardScale = interpolate(p1CardSpring, [0, 1], [0.9, 1]);

  const p1TypingFrame = Math.max(0, frame - 55);
  const p1TypingProgress = interpolate(p1TypingFrame, [0, 60], [0, 1], { easing: Easing.bezier(0.25, 0.1, 0.25, 1), extrapolateRight: 'clamp' });
  const promptText = `// The standard prompt\n"You are a helpful assistant. Please extract the user data and make sure you return valid JSON. Do not hallucinate, and please format it nicely without any errors..."`;
  const p1Chars = Math.floor(p1TypingProgress * promptText.length);

  const errorFrame = Math.max(0, frame - 120);
  const errorFlash = interpolate(errorFrame, [0, 2, 10], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const p1ExitSpring = spring({ frame: Math.max(0, frame - 155), fps, config: { damping: 18, stiffness: 120 } });
  
  // ==========================
  // PHASE 2: COMPILER (165 - 315)
  // ==========================
  const title2Words = "What if prompts had compiler rigor?".split(" ");
  
  const p2CardSpring = spring({ frame: Math.max(0, frame - 190), fps, config: { damping: 14, stiffness: 90 } });
  const p2CardBlur = interpolate(p2CardSpring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  
  const tag1Spring = spring({ frame: Math.max(0, frame - 220), fps, config: { damping: 16, stiffness: 120 } });
  const tag2Spring = spring({ frame: Math.max(0, frame - 225), fps, config: { damping: 16, stiffness: 120 } });
  const tag3Spring = spring({ frame: Math.max(0, frame - 230), fps, config: { damping: 16, stiffness: 120 } });

  const successFrame = Math.max(0, frame - 260);
  const successSpring = spring({ frame: successFrame, fps, config: { damping: 16, stiffness: 120 } });
  const successGlow = interpolate(successFrame, [0, 10, 30], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const p2ExitSpring = spring({ frame: Math.max(0, frame - 305), fps, config: { damping: 18, stiffness: 120 } });

  // ==========================
  // PHASE 3: GENESIS (315 - 450)
  // ==========================
  const genesisFrame = Math.max(0, frame - 315);
  const monolithSpring = spring({ frame: genesisFrame, fps, config: { damping: 14, stiffness: 80 } });
  const monolithBlur = interpolate(monolithSpring, [0, 0.8, 1], [15, 0, 0], { extrapolateRight: 'clamp' });
  const decryptProgress = interpolate(genesisFrame, [10, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
        perspective: '1400px',
        transform: `scale(${diveZoom})`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 60%)', filter: `blur(${bgBlur}px)` }} />

      {/* PHASE 1 */}
      {frame < 170 && (
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - p1ExitSpring, transform: `translateY(${interpolate(p1ExitSpring, [0, 1], [0, -30])}px)` }}>
          <div style={{ display: 'flex', gap: '12px', fontSize: '56px', fontWeight: 600, letterSpacing: '-0.03em', color: '#ffffff', marginBottom: '40px' }}>
            {title1Words.map((word, i) => {
              const wSpring = spring({ frame: Math.max(0, frame - i * 3), fps, config: { damping: 14, stiffness: 100 } });
              return (
                <span key={i} style={{ opacity: wSpring, transform: `translateY(${interpolate(wSpring, [0, 1], [15, 0])}px)`, display: 'inline-block' }}>
                  {word}
                </span>
              );
            })}
          </div>

          <div style={{ width: '800px', padding: '2px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', opacity: p1CardSpring, transform: `scale(${p1CardScale}) translateY(${interpolate(p1CardSpring, [0, 1], [40, 0])}px)`, filter: `blur(${p1CardBlur}px)` }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '22px', padding: '40px', width: '100%', height: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              </div>
              
              <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '16px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {promptText.substring(0, p1Chars)}
              </div>
              
              {errorFrame > 0 && (
                <div style={{ marginTop: '20px', borderLeft: '2px solid #ef4444', paddingLeft: '16px', color: '#ef4444', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", backgroundColor: `rgba(239, 68, 68, ${errorFlash * 0.2})`, textShadow: `0 0 ${errorFlash * 10}px rgba(239, 68, 68, 0.8)` }}>
                  TypeError: Unexpected token ' in JSON at position 114
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2 */}
      {frame >= 165 && frame < 320 && (
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - p2ExitSpring, transform: `translateY(${interpolate(p2ExitSpring, [0, 1], [0, -30])}px)` }}>
          <div style={{ display: 'flex', gap: '12px', fontSize: '56px', fontWeight: 600, letterSpacing: '-0.03em', color: '#ffffff', marginBottom: '40px' }}>
            {title2Words.map((word, i) => {
              const wSpring = spring({ frame: Math.max(0, frame - 165 - i * 3), fps, config: { damping: 14, stiffness: 100 } });
              return (
                <span key={i} style={{ opacity: wSpring, transform: `translateY(${interpolate(wSpring, [0, 1], [15, 0])}px)`, display: 'inline-block' }}>
                  {word}
                </span>
              );
            })}
          </div>

          <div style={{ width: '800px', padding: '2px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 100%)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', opacity: p2CardSpring, transform: `scale(${interpolate(p2CardSpring, [0,1], [0.9, 1])}) translateY(${interpolate(p2CardSpring, [0, 1], [40, 0])}px)`, filter: `blur(${p2CardBlur}px)` }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '22px', padding: '40px', width: '100%', height: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
              </div>
              
              <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '15px', lineHeight: 1.8 }}>
                <div style={{ opacity: tag1Spring, transform: `translateY(${interpolate(tag1Spring, [0, 1], [10, 0])}px)` }}>
                  <span style={{ color: '#10b981' }}>&lt;system_persona&gt;</span> <span style={{ color: 'rgba(255,255,255,0.9)' }}>Principal Distributed Architect</span> <span style={{ color: '#10b981' }}>&lt;/system_persona&gt;</span>
                </div>
                <div style={{ opacity: tag2Spring, transform: `translateY(${interpolate(tag2Spring, [0, 1], [10, 0])}px)` }}>
                  <span style={{ color: '#06b6d4' }}>&lt;negative_constraints&gt;</span> <span style={{ color: 'rgba(255,255,255,0.9)' }}>Strict No-Any, Zero-Null, RFC 7807 Error Model</span> <span style={{ color: '#06b6d4' }}>&lt;/negative_constraints&gt;</span>
                </div>
                <div style={{ opacity: tag3Spring, transform: `translateY(${interpolate(tag3Spring, [0, 1], [10, 0])}px)` }}>
                  <span style={{ color: '#3b82f6' }}>&lt;runtime_target&gt;</span> <span style={{ color: 'rgba(255,255,255,0.9)' }}>Dual-Runtime (Tauri 2.0 / Electron 43.3)</span> <span style={{ color: '#3b82f6' }}>&lt;/runtime_target&gt;</span>
                </div>
              </div>
              
              <div style={{ opacity: successSpring, marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", textShadow: `0 0 ${successGlow * 15}px rgba(16, 185, 129, 0.8)` }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: `0 0 ${successGlow * 10}px #10b981` }} />
                COMPILED · DETERMINISTIC SCHEMA ENFORCED
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 3 */}
      {frame >= 305 && (
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${interpolate(monolithSpring, [0, 1], [0.9, 1])}) translateY(${interpolate(monolithSpring, [0, 1], [30, 0])}px)`, opacity: monolithSpring, filter: `blur(${monolithBlur}px)` }}>
          <div style={{ position: 'relative', width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
            <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(16, 185, 129, 0.15))' }} />
          </div>
          <div style={{ fontSize: '64px', fontWeight: 700, letterSpacing: '-0.04em', color: '#ffffff', marginBottom: '16px' }}>
            {getScrambledText('BEDROCK WORKSTATION', decryptProgress, frame)}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 400, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.5)' }}>
            The enterprise prompt engineering workstation.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
