import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { AUDIO } from './audio';
import { FilmGrade, Stage } from './components/Stage';
import { Subtitles } from './components/Subtitles';
import { Arena } from './scenes/Arena';
import { Branching } from './scenes/Branching';
import { Export } from './scenes/Export';
import { Finale } from './scenes/Finale';
import { Generator } from './scenes/Generator';
import { Problem } from './scenes/Problem';
import { Reveal } from './scenes/Reveal';
import { SCENES, WORDS } from './timeline';
import { TOTAL_FRAMES } from './theme';

// ============================================================================
// BEDROCK — 60-second launch film (problem → solution).
// Scene boundaries and every animation beat are derived from the narration
// word timings (timeline.ts), so picture, voice and subtitles stay locked.
// ============================================================================

const SCENE_LIST = [
  { id: 'problem', C: Problem },
  { id: 'reveal', C: Reveal },
  { id: 'generator', C: Generator },
  { id: 'branching', C: Branching },
  { id: 'arena', C: Arena },
  { id: 'export', C: Export },
  { id: 'cta', C: Finale },
] as const;

// Simple sidechain for the fallback soundtrack (the real score is pre-ducked).
const speaking = (f: number) => WORDS.some((w) => f >= w.from - 8 && f <= w.to + 12);

export const BedrockLaunch: React.FC = () => (
  <Stage>
    {SCENE_LIST.map(({ id, C }) => (
      <Sequence key={id} from={SCENES[id].from} durationInFrames={SCENES[id].dur} name={id}>
        <C />
      </Sequence>
    ))}

    <Subtitles />
    <FilmGrade />

    {/* ---- audio ---- */}
    {AUDIO.score ? (
      <Audio src={staticFile(AUDIO.score)} />
    ) : (
      <Audio
        src={staticFile(AUDIO.fallbackMusic)}
        volume={(f) => {
          const fade = f > TOTAL_FRAMES - 40 ? (TOTAL_FRAMES - f) / 40 : 1;
          return (speaking(f) ? 0.16 : 0.32) * Math.max(0, fade);
        }}
      />
    )}
  </Stage>
);
