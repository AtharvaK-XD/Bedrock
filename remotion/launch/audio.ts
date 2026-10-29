// ============================================================================
// Audio wiring. `score` is the final master from scripts/launch-video/
// build_score.py: music + sound design + narration, ducked and limited, locked
// to the timeline cues. When it is null, the old soundtrack plays instead (no
// voice). Paths are relative to public/.
// ============================================================================

export const AUDIO: { score: string | null; fallbackMusic: string } = {
  score: 'audio/launch/mix.mp3',
  fallbackMusic: 'audio/soundtrack-mastered.wav',
};
