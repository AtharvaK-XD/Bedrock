import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SUBTITLE_MUTED, SUBTITLE_MUTED_PHRASES } from '../script';
import { C, EASE, FONT, tween } from '../theme';
import { cue, WORDS, type Word } from '../timeline';

// Words from a muted phrase to the end of its section are shown as big type.
const mutedFrom = SUBTITLE_MUTED_PHRASES.map((m) => ({ section: m.section, frame: cue(m.section, m.from, 2) }));
const isMuted = (w: Word) =>
  SUBTITLE_MUTED.includes(w.section) || mutedFrom.some((m) => m.section === w.section && w.from >= m.frame);

interface Caption {
  words: Word[];
  from: number;
  to: number;
}

const MAX_WORDS = 7;

// Split narration into clauses (sentence ends, commas, section changes), keep
// tiny clauses with their neighbour, and split long clauses into balanced
// halves — then each word lights up exactly when it is spoken.
const buildCaptions = (): Caption[] => {
  const clauses: Word[][] = [];
  let current: Word[] = [];
  WORDS.filter((w) => !isMuted(w)).forEach((w, i, arr) => {
    const prev = arr[i - 1];
    if (current.length && prev && (prev.section !== w.section || w.from - prev.to > 40)) {
      clauses.push(current);
      current = [];
    }
    current.push(w);
    if (/[.!?:,]$/.test(w.text)) {
      clauses.push(current);
      current = [];
    }
  });
  if (current.length) clauses.push(current);

  const merged: Word[][] = [];
  clauses.forEach((c) => {
    const last = merged[merged.length - 1];
    const lastWord = last?.[last.length - 1];
    const joinable = last && lastWord && /,$/.test(lastWord.text) && lastWord.section === c[0].section && c[0].from - lastWord.to < 40;
    if (joinable && (last.length <= 2 || c.length <= 2) && last.length + c.length <= MAX_WORDS) last.push(...c);
    else merged.push([...c]);
  });

  const lines: Word[][] = [];
  merged.forEach((c) => {
    if (c.length <= MAX_WORDS) return lines.push(c);
    const k = Math.ceil(c.length / 6);
    const size = Math.ceil(c.length / k);
    for (let i = 0; i < c.length; i += size) lines.push(c.slice(i, i + size));
  });

  return lines.map((ws, i) => {
    const next = lines[i + 1];
    const from = ws[0].from - 5;
    const natural = ws[ws.length - 1].to + 26;
    const to = next ? Math.min(natural, next[0].from - 5) : natural;
    return { words: ws, from, to: Math.max(to, ws[ws.length - 1].to + 4) };
  });
};

const CAPTIONS = buildCaptions();

export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const cap = CAPTIONS.find((c) => frame >= c.from && frame < c.to);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 260,
          background: 'linear-gradient(180deg, transparent 0%, rgba(2,3,4,0.55) 100%)',
          opacity: cap ? tween(frame, [cap.from, cap.from + 10]) * tween(frame, [cap.to - 8, cap.to], [1, 0]) : 0,
        }}
      />
      {cap && (
        <div
          style={{
            position: 'absolute',
            left: 160,
            right: 160,
            bottom: 74,
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            columnGap: '0.3em',
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 38,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            transform: `translateY(${(1 - tween(frame, [cap.from, cap.from + 10])) * 14}px)`,
            opacity: tween(frame, [cap.from, cap.from + 8]) * tween(frame, [cap.to - 8, cap.to], [1, 0], EASE.inOut),
            textShadow: '0 2px 18px rgba(0,0,0,0.75)',
          }}
        >
          {cap.words.map((w, i) => {
            const spoken = frame >= w.from;
            const active = frame >= w.from && frame < w.to + 3;
            const lit = tween(frame, [w.from - 1, w.from + 4]);
            return (
              <span
                key={i}
                style={{
                  color: active ? C.tealLight : spoken ? C.text : 'rgba(244,247,246,0.34)',
                  opacity: 0.55 + lit * 0.45,
                  transition: 'none',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
