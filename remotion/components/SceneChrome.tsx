import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, LAYOUT_ZONES } from './MotionTokens';

interface SceneChromeProps {
  eyebrow: string;
  headline: string;
  caption?: string;
  keyWord?: string;
  sceneFrame: number; // local frame within scene
  sceneDuration: number;
  hideHeadline?: boolean;
  hideCaption?: boolean;
  immediateHeadline?: boolean;
  captionStartFrame?: number;
  captionEndFrame?: number;
}

export const SceneChrome: React.FC<SceneChromeProps> = ({
  eyebrow,
  headline,
  caption,
  keyWord,
  sceneFrame,
  sceneDuration,
  hideHeadline = false,
  hideCaption = false,
  immediateHeadline = false,
  captionStartFrame,
  captionEndFrame,
}) => {
  const frame = sceneFrame;
  const { fps } = useVideoConfig();

  // Eyebrow animation (W6 decode / slide in)
  const eyebrowIn = interpolate(frame, [0, 15], [0, 1], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Headline animation (per-word mask reveal, blur 14 -> 0, tracking +6% -> 0)
  const words = headline.split(' ');
  const headlineEnterDelay = immediateHeadline ? 0 : 4;
  
  // Shine pass: diagonal highlight sweeps once 300 ms (18 frames) after landing
  const shineProgress = interpolate(frame, [25, 45], [-100, 200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shineOpacity = interpolate(frame, [25, 30, 38, 44], [0, 0.45, 0.45, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cleanKeyTokens = keyWord
    ? keyWord.toLowerCase().replace(/[.?]/g, '').split(' ')
    : [];

  // Scene exit fade
  const exitFrames = 12;
  const exitOpacity = interpolate(
    frame,
    [sceneDuration - exitFrames, sceneDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <>
      {/* ======================================================== */}
      {/* 🏷️ EYEBROW ZONE (y: 56 - 88)                             */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: `${LAYOUT_ZONES.eyebrow.top}px`,
          left: 0,
          right: 0,
          height: `${LAYOUT_ZONES.eyebrow.height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          opacity: eyebrowIn * exitOpacity,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            color: COLORS.mint,
            fontSize: `${LAYOUT_ZONES.eyebrow.fontSize}px`,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 8px #10b981' }} />
          <span>{eyebrow}</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 8px #10b981' }} />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📰 HEADLINE ZONE (y: 100 - 180, clearance >= 50px)      */}
      {/* ======================================================== */}
      {!hideHeadline && (
        <div
          style={{
            position: 'absolute',
            top: `${LAYOUT_ZONES.headline.top}px`,
            left: 0,
            right: 0,
            height: `${LAYOUT_ZONES.headline.height}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
            opacity: exitOpacity,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              maxWidth: `${LAYOUT_ZONES.headline.maxWidth}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              flexWrap: 'nowrap',
              position: 'relative',
            }}
          >
            {words.map((word, i) => {
              const wordDelay = headlineEnterDelay + i * 4;
              const wordSpring = immediateHeadline
                ? 1.0
                : interpolate(frame, [wordDelay, wordDelay + 16], [0, 1], {
                    easing: EASINGS.OUT_EXPO,
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });
              const wordBlur = immediateHeadline ? 0 : interpolate(wordSpring, [0, 1], [14, 0]);
              const wordY = immediateHeadline ? 0 : interpolate(wordSpring, [0, 1], [16, 0]);
              const isKey = Boolean(keyWord && cleanKeyTokens.includes(word.toLowerCase().replace(/[.?]/g, '')));

              // Underline draw for key word (400 ms = 24 frames)
              const underlineProgress = isKey
                ? interpolate(frame, [wordDelay + 10, wordDelay + 34], [0, 1], {
                    easing: EASINGS.OUT_EXPO,
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })
                : 0;

              return (
                <span
                  key={`${word}-${i}`}
                  style={{
                    position: 'relative',
                    fontSize: `${LAYOUT_ZONES.headline.fontSize}px`,
                    fontWeight: 700,
                    letterSpacing: '-0.035em',
                    color: isKey ? '#ffffff' : COLORS.white,
                    filter: `blur(${wordBlur}px)`,
                    opacity: wordSpring,
                    transform: `translateY(${wordY}px)`,
                    fontFamily: "'Inter', sans-serif",
                    textShadow: isKey
                      ? '0 0 25px rgba(16, 185, 129, 0.5), 0 0 45px rgba(16, 185, 129, 0.25)'
                      : '0 2px 20px rgba(0, 0, 0, 0.8)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {word}
                  {isKey && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: '-6px',
                        height: '3px',
                        width: `${underlineProgress * 100}%`,
                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                        boxShadow: '0 0 12px rgba(16, 185, 129, 0.8)',
                        borderRadius: '2px',
                      }}
                    />
                  )}
                </span>
              );
            })}

            {/* Subtle Shine Pass Sweep */}
            {shineOpacity > 0.01 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${shineProgress}%`,
                  width: '120px',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  transform: 'skewX(-25deg)',
                  opacity: shineOpacity,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 💬 CAPTION ZONE (y: 940 - 1030, clearance with pill > 40px)*/}
      {/* ======================================================== */}
      {!hideCaption && caption && (
        <div
          style={{
            position: 'absolute',
            top: `${LAYOUT_ZONES.caption.top}px`,
            left: 0,
            right: 0,
            height: `${LAYOUT_ZONES.caption.height}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
            opacity: exitOpacity,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              maxWidth: `${LAYOUT_ZONES.caption.maxWidth}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              textAlign: 'center',
            }}
          >
            {caption.split(' ').map((word, i, arr) => {
              // Word fill sweep: enters at captionStartFrame (or 15), finishes at captionEndFrame (or sceneDuration - 35)
              const captionStart = captionStartFrame !== undefined ? captionStartFrame : 15;
              const captionEnd = captionEndFrame !== undefined ? captionEndFrame : Math.max(captionStart + 30, sceneDuration - 35);
              const captionDuration = Math.max(15, captionEnd - captionStart);
              const wordThreshold = (i / arr.length) * captionDuration + captionStart;
              const isFilled = frame >= wordThreshold;
              const fillSpring = interpolate(frame, [wordThreshold - 4, wordThreshold + 4], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <span
                  key={`${word}-${i}`}
                  style={{
                    fontSize: `${LAYOUT_ZONES.caption.fontSize}px`,
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    fontFamily: "'Inter', sans-serif",
                    color: isFilled ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                    textShadow: isFilled ? '0 0 20px rgba(255, 255, 255, 0.3)' : 'none',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
