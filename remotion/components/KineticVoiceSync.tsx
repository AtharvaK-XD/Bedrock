import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

interface SubtitleCue {
  startFrame: number;
  endFrame: number;
  text: string;
}

// Calibrated against the +8% edge-tts ChristopherNeural master narration
const CUES: SubtitleCue[] = [
  { startFrame: 3, endFrame: 107, text: "Engineering AI prompts isn't guess work anymore." },
  { startFrame: 107, endFrame: 175, text: "It is software architecture." },
  { startFrame: 175, endFrame: 341, text: "But today, prompts decay, models drift, and production systems break silently." },
  { startFrame: 341, endFrame: 392, text: "Meet Bedrock." },
  { startFrame: 392, endFrame: 517, text: "The premier engineering workstation built for frontier intelligence." },
  { startFrame: 517, endFrame: 581, text: "Ten frontier models." },
  { startFrame: 581, endFrame: 633, text: "Zero lock-in." },
  { startFrame: 633, endFrame: 694, text: "Real-time telemetry." },
  { startFrame: 694, endFrame: 811, text: "From zero-shot to production-grade directives in milliseconds." },
  { startFrame: 811, endFrame: 970, text: "Multi-pass reasoning, strict schema validation, and zero-coding archetypes." },
  { startFrame: 970, endFrame: 1104, text: "Architect complex agentic reasoning on an infinite DAG canvas." },
  { startFrame: 1104, endFrame: 1307, text: "Branch workflows, run parallel evaluations, and prune dead paths with tactile physics." },
  { startFrame: 1307, endFrame: 1407, text: "Pit frontier LLMs head-to-head in the Arena." },
  { startFrame: 1407, endFrame: 1548, text: "Then export hardened system directives across fifteen production frameworks." },
  { startFrame: 1548, endFrame: 1600, text: "Stop guessing." },
  { startFrame: 1600, endFrame: 1656, text: "Start engineering." },
  { startFrame: 1656, endFrame: 1698, text: "Bedrock." },
  { startFrame: 1698, endFrame: 1785, text: "The bedrock of intelligent software." },
];

export const KineticVoiceSync: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentCue = CUES.find((c) => frame >= c.startFrame && frame < c.endFrame);

  if (!currentCue) return null;

  const cueProgress = (frame - currentCue.startFrame) / (currentCue.endFrame - currentCue.startFrame);
  const words = currentCue.text.split(' ');
  
  // Smoothly animate the words appearing
  const activeWordIndex = Math.min(words.length - 1, Math.floor(cueProgress * words.length));

  const barOpacity = interpolate(
    frame,
    [currentCue.startFrame, currentCue.startFrame + 10, currentCue.endFrame - 10, currentCue.endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '60px',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: barOpacity,
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          maxWidth: '1200px',
        }}
      >
        {words.map((word, i) => {
          const isSpoken = i <= activeWordIndex;
          
          return (
            <span
              key={`${word}-${i}`}
              style={{
                fontSize: '28px',
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                color: isSpoken ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                transition: 'color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                letterSpacing: '-0.02em',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
