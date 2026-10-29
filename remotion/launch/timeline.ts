import narration from './data/narration.json';
import { SCRIPT, type SectionId } from './script';
import { FPS, TOTAL_FRAMES } from './constants';

// ============================================================================
// Timeline — turns narration word timings into absolute frames so every
// animation beat lands on the exact word that is being spoken.
// ============================================================================

interface NarrationWord {
  text: string;
  start: number; // seconds, relative to the section clip
  end: number;
}

interface NarrationSection {
  id: SectionId;
  file: string; // repo-relative voice take (remotion/launch/audio-src/...)
  start: number; // seconds, absolute
  duration: number;
  words: NarrationWord[];
}

interface NarrationFile {
  source: 'placeholder' | 'edge' | 'elevenlabs';
  sections: NarrationSection[];
}

export interface Word {
  text: string;
  norm: string;
  section: SectionId;
  from: number; // absolute frame
  to: number;
}

export interface SectionTiming {
  id: SectionId;
  from: number; // first spoken frame
  to: number; // last spoken frame
  audio: string | null;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Rough speech model used only until real ElevenLabs timings exist.
const synthesize = (): NarrationSection[] =>
  SCRIPT.map((s) => {
    let t = 0;
    const words: NarrationWord[] = s.text.split(/\s+/).map((w) => {
      const dur = 0.13 + 0.047 * w.replace(/[^\w]/g, '').length;
      const word = { text: w, start: t, end: t + dur };
      t += dur + (/[.:]$/.test(w) ? 0.42 : /,$/.test(w) ? 0.16 : 0.03);
      return word;
    });
    return { id: s.id, file: '', start: s.start, duration: t, words };
  });

const data = narration as NarrationFile;
export const IS_PLACEHOLDER_VO = data.source === 'placeholder' || data.sections.length === 0;
const sections: NarrationSection[] = IS_PLACEHOLDER_VO ? synthesize() : data.sections;

const toFrame = (sec: number) => Math.round(sec * FPS);

export const WORDS: Word[] = sections.flatMap((s) =>
  s.words.map((w) => ({
    text: w.text,
    norm: normalize(w.text),
    section: s.id,
    from: toFrame(s.start + w.start),
    to: toFrame(s.start + w.end),
  })),
);

export const SECTIONS = Object.fromEntries(
  sections.map((s) => {
    const ws = WORDS.filter((w) => w.section === s.id);
    return [
      s.id,
      {
        id: s.id,
        from: ws.length ? ws[0].from : toFrame(s.start),
        to: ws.length ? ws[ws.length - 1].to : toFrame(s.start + s.duration),
        audio: s.file || null,
      },
    ];
  }),
) as Record<SectionId, SectionTiming>;

export const VO_CLIPS = sections
  .filter((s) => s.file)
  .map((s) => ({ id: s.id, file: s.file, from: toFrame(s.start) }));

// Visual scenes open a little before their voice line so transitions breathe.
const SCENE_LEAD: Record<SectionId, number> = {
  problem: 0,
  reveal: 14,
  generator: 20,
  branching: 18,
  arena: 18,
  export: 18,
  cta: 24,
};

const order = SCRIPT.map((s) => s.id);
export const SCENES = Object.fromEntries(
  order.map((id, i) => {
    const from = i === 0 ? 0 : Math.max(0, SECTIONS[id].from - SCENE_LEAD[id]);
    const nextId = order[i + 1];
    const to = nextId ? Math.max(0, SECTIONS[nextId].from - SCENE_LEAD[nextId]) : TOTAL_FRAMES;
    return [id, { from, dur: Math.max(1, to - from) }];
  }),
) as Record<SectionId, { from: number; dur: number }>;

/**
 * Absolute frame where `phrase` starts being spoken inside `section`.
 * Falls back to a fraction of the section if the phrase was edited out.
 */
export const cue = (section: SectionId, phrase: string, fallback = 0): number => {
  const ws = WORDS.filter((w) => w.section === section);
  const tokens = phrase.split(/\s+/).map(normalize).filter(Boolean);
  for (let i = 0; i + tokens.length <= ws.length; i++) {
    if (tokens.every((t, j) => ws[i + j].norm === t)) return ws[i].from;
  }
  const s = SECTIONS[section];
  return Math.round(s.from + (s.to - s.from) * fallback);
};

/** Frame where `phrase` finishes being spoken. */
export const cueEnd = (section: SectionId, phrase: string, fallback = 1): number => {
  const ws = WORDS.filter((w) => w.section === section);
  const tokens = phrase.split(/\s+/).map(normalize).filter(Boolean);
  for (let i = 0; i + tokens.length <= ws.length; i++) {
    if (tokens.every((t, j) => ws[i + j].norm === t)) return ws[i + tokens.length - 1].to;
  }
  const s = SECTIONS[section];
  return Math.round(s.from + (s.to - s.from) * fallback);
};

/** Start frame of every word in `phrase` (for word-synced kinetic type). */
export const cueWords = (section: SectionId, phrase: string, fallback = 0, gap = 9): number[] => {
  const ws = WORDS.filter((w) => w.section === section);
  const tokens = phrase.split(/\s+/).map(normalize).filter(Boolean);
  for (let i = 0; i + tokens.length <= ws.length; i++) {
    if (tokens.every((t, j) => ws[i + j].norm === t)) return tokens.map((_, j) => ws[i + j].from);
  }
  const start = cue(section, phrase, fallback);
  return tokens.map((_, j) => start + j * gap);
};

/** Cue helper bound to a scene: returns frames local to that scene's Sequence. */
export const sceneCues = (id: SectionId) => {
  const base = SCENES[id].from;
  return {
    at: (phrase: string, fallback = 0) => cue(id, phrase, fallback) - base,
    end: (phrase: string, fallback = 1) => cueEnd(id, phrase, fallback) - base,
    words: (phrase: string, fallback = 0) => cueWords(id, phrase, fallback).map((f) => f - base),
    dur: SCENES[id].dur,
  };
};
