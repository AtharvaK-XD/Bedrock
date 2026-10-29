// Writes remotion/launch/data/cues.json (hits, music markers, speech ranges)
// for scripts/launch-video/build_score.py. Run: npx tsx scripts/launch-video/export-cues.mts
import fs from 'node:fs';
import path from 'node:path';
import { HITS, MUSIC } from '../../remotion/launch/beats.ts';
import { SCENES, WORDS, VO_CLIPS } from '../../remotion/launch/timeline.ts';
import { FPS, TOTAL_FRAMES } from '../../remotion/launch/constants.ts';

const out = {
  fps: FPS,
  totalFrames: TOTAL_FRAMES,
  hits: HITS,
  music: MUSIC,
  scenes: SCENES,
  speech: WORDS.map((w) => [w.from, w.to]),
  vo: VO_CLIPS,
};
const file = path.resolve('remotion/launch/data/cues.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`wrote ${HITS.length} hits to ${path.relative(process.cwd(), file)}`);
