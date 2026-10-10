import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export const Scene6MonolithicFinale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgBlur = interpolate(frame, [0, 15], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sceneOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cameraZoom = interpolate(frame, [0, 250], [0.98, 1.05]);

  const phase = frame < 52 ? 1 : frame < 108 ? 2 : frame < 150 ? 3 : 4;

  const wordSpring1 = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const word1Blur = interpolate(wordSpring1, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  
  const wordSpring2 = spring({ frame: Math.max(0, frame - 52), fps, config: { damping: 14, stiffness: 90 } });
  const word2Blur = interpolate(wordSpring2, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  
  const logoSpring = spring({ frame: Math.max(0, frame - 108), fps, config: { damping: 12, stiffness: 80 } });
  const logoBlur = interpolate(logoSpring, [0, 0.8, 1], [20, 0, 0], { extrapolateRight: 'clamp' });

  const tagline1Spring = spring({ frame: Math.max(0, frame - 128), fps, config: { damping: 14, stiffness: 90 } });
  const tagline2Spring = spring({ frame: Math.max(0, frame - 132), fps, config: { damping: 14, stiffness: 90 } });
  
  const shockwaveScale = interpolate(frame, [108, 200], [0.5, 3.0], { extrapolateRight: 'clamp' });
  const shockwaveOpacity = interpolate(frame, [108, 140, 200], [0, 0.15, 0], { extrapolateRight: 'clamp' });

  // Typewriter
  const typingFrame = Math.max(0, frame - 160);
  const typingProgress = interpolate(typingFrame, [0, 60], [0, 1], { easing: Easing.bezier(0.25, 0.1, 0.25, 1), extrapolateRight: 'clamp' });
  const cmd = "yarn global add @bedrock/cli";
  const charsToShow = Math.floor(typingProgress * cmd.length);
  const typedCmd = cmd.substring(0, charsToShow);
  
  const showCursor = Math.floor(frame / 15) % 2 === 0;

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
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)', filter: `blur(${bgBlur}px)` }} />

      {frame >= 108 && (
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', border: '1px solid rgba(255,255,255,1)', transform: `scale(${shockwaveScale})`, opacity: shockwaveOpacity, pointerEvents: 'none' }} />
      )}

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${cameraZoom})`, position: 'relative', zIndex: 10 }}>
        
        {phase === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${interpolate(wordSpring1, [0, 1], [0.9, 1])}) translateY(${interpolate(wordSpring1, [0, 1], [40, 0])}px)`, opacity: wordSpring1, filter: `blur(${word1Blur}px)` }}>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '16px' }}>THE PAST</span>
            <h1 style={{ fontSize: '96px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.04em', margin: 0 }}>Stop guessing.</h1>
          </div>
        )}

        {phase === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${interpolate(wordSpring2, [0, 1], [0.9, 1])}) translateY(${interpolate(wordSpring2, [0, 1], [40, 0])}px)`, opacity: wordSpring2, filter: `blur(${word2Blur}px)` }}>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '16px' }}>THE FUTURE</span>
            <h1 style={{ fontSize: '96px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.04em', margin: 0 }}>Start engineering.</h1>
          </div>
        )}

        {phase >= 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
            
            <div style={{ transform: `scale(${interpolate(logoSpring, [0, 1], [0.6, 1])}) translateY(${interpolate(logoSpring, [0, 1], [-80, 0])}px)`, opacity: logoSpring, filter: `blur(${logoBlur}px)`, width: '120px', height: '120px', borderRadius: '28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Img src={staticFile('logo.png')} style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ opacity: tagline1Spring, transform: `translateY(${interpolate(tagline1Spring, [0, 1], [15, 0])}px)`, fontSize: '72px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
                Bedrock
              </h1>
              <p style={{ opacity: tagline2Spring, transform: `translateY(${interpolate(tagline2Spring, [0, 1], [15, 0])}px)`, fontSize: '18px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.02em', margin: 0 }}>
                The bedrock of intelligent software.
              </p>
            </div>

            <div style={{ opacity: Math.min(1, typingFrame), marginTop: '32px', fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', padding: '16px 32px', borderRadius: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>$</span>
              <span>{typedCmd}</span>
              <span style={{ opacity: showCursor ? 1 : 0, color: '#ffffff' }}>█</span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
