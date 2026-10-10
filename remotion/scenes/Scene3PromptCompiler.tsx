import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export const Scene3PromptCompiler: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Depth of field cue on transitions
  const bgBlur = interpolate(frame, [0, 15, 265, 280], [12, 0, 0, 12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sceneOpacity = interpolate(frame, [0, 15, 265, 280], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cameraZoom = interpolate(frame, [0, 280], [0.97, 1.05]);

  const title1Spring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14, stiffness: 90 } });
  const title2Spring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 14, stiffness: 90 } });

  const rawBoxSpring = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 14, stiffness: 90 } });
  const prismSpring = spring({ frame: Math.max(0, frame - 50), fps, config: { damping: 14, stiffness: 90 } });
  const compiledBoxSpring = spring({ frame: Math.max(0, frame - 70), fps, config: { damping: 14, stiffness: 90 } });

  const rawBoxBlur = interpolate(rawBoxSpring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  const compiledBoxBlur = interpolate(compiledBoxSpring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });

  const isMultiPassPhase = frame >= 110;

  // Particle flow cue from left to right
  const particleOffset = (frame * 6) % 100;

  // Typewriter effect for directive.xml
  const typingFrame = Math.max(0, frame - 90);
  const typingProgress = interpolate(typingFrame, [0, 120], [0, 1], { easing: Easing.bezier(0.25, 0.1, 0.25, 1), extrapolateRight: 'clamp' });
  
  // Syncing percentage to the typing progress
  const tokenWeight = Math.min(100, Math.floor(typingProgress * 100));

  const xmlLines = [
    { text: '<role archetype="image_generation" strict="true">', color: '#38bdf8' },
    { text: '  <anti_hallucination>Zero coding instructions.</anti_hallucination>', color: '#f43f5e' },
    { text: '  <aspect_ratio>16:9 Cinema 4K</aspect_ratio>', color: '#a78bfa' },
    { text: '  <reasoning_passes>4x Verification</reasoning_passes>', color: '#38bdf8' },
    { text: '</role>', color: '#38bdf8' },
  ];

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
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)', filter: `blur(${bgBlur}px)` }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${cameraZoom})`, position: 'relative' }}>
        
        {/* Header Titles */}
        <div style={{ position: 'absolute', top: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 30 }}>
          <div style={{ transform: `scale(${interpolate(title1Spring, [0,1], [0.9, 1])}) translateY(${interpolate(title1Spring, [0, 1], [-20, 0])}px)`, opacity: title1Spring, color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Neural Prompt Compiler
          </div>
          <h2 style={{ fontSize: '64px', fontWeight: 600, letterSpacing: '-0.03em', color: '#ffffff', margin: 0, transform: `scale(${interpolate(title2Spring, [0,1], [0.9, 1])}) translateY(${interpolate(title2Spring, [0, 1], [-20, 0])}px)`, opacity: title2Spring }}>
            {!isMultiPassPhase ? 'Zero-shot to production.' : 'Multi-pass reasoning.'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', width: '1400px', marginTop: '40px', zIndex: 20 }}>
          
          {/* Left Panel */}
          <div style={{ transform: `scale(${interpolate(rawBoxSpring, [0, 1], [0.9, 1])}) translateY(${interpolate(rawBoxSpring, [0, 1], [30, 0])}px)`, opacity: rawBoxSpring, filter: `blur(${rawBoxBlur}px)`, width: '400px', height: '320px', padding: '1px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '23px', padding: '32px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>raw_intent.txt</span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', flex: 1 }}>
                "Create a master system prompt for an image and video generation director. Ensure zero coding hallucinations, strict visual composition, and deterministic cinematic output."
              </div>
            </div>
          </div>

          {/* Flow Cue */}
          <div style={{ transform: `scale(${interpolate(prismSpring, [0, 1], [0.9, 1])})`, opacity: prismSpring, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '120px', position: 'relative', gap: '12px' }}>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: `${particleOffset}%`, width: '20px', height: '100%', background: '#ffffff', boxShadow: '0 0 10px #ffffff', transform: 'translateX(-50%)' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.05em' }}>
              COMPILING
            </span>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: `${(particleOffset + 50) % 100}%`, width: '20px', height: '100%', background: '#ffffff', boxShadow: '0 0 10px #ffffff', transform: 'translateX(-50%)' }} />
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ transform: `scale(${interpolate(compiledBoxSpring, [0, 1], [0.9, 1])}) translateY(${interpolate(compiledBoxSpring, [0, 1], [30, 0])}px)`, opacity: compiledBoxSpring, filter: `blur(${compiledBoxBlur}px)`, width: '560px', height: '320px', padding: '1px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 100%)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '23px', padding: '32px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#10b981' }}>directive.xml</span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {tokenWeight}% SYNTHESIZED
                </span>
              </div>

              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)', flex: 1, overflow: 'hidden' }}>
                {xmlLines.map((line, i) => {
                  const lineReveal = interpolate(typingProgress * 5 - i, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                  const charsToShow = Math.floor(lineReveal * line.text.length);
                  if (charsToShow === 0) return null;
                  
                  return (
                    <div key={i} style={{ color: line.color, whiteSpace: 'pre-wrap' }}>
                      {line.text.substring(0, charsToShow)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
