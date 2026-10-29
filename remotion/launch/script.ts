import scriptData from './data/script.json';

// ============================================================================
// Narration script — words, pacing and scene order all come from
// data/script.json, which scripts/launch-video/generate_voiceover.py also
// reads. Edit the JSON, not this file.
// ============================================================================

export type SectionId = 'problem' | 'reveal' | 'generator' | 'branching' | 'arena' | 'export' | 'cta';

export interface ScriptSection {
  id: SectionId;
  start: number;
  text: string;
}

export const SCRIPT = (scriptData as { sections: ScriptSection[] }).sections;

// Sections whose words are shown as large on-screen typography; the bottom
// subtitle track is muted there so the same words never appear twice.
export const SUBTITLE_MUTED: SectionId[] = ['reveal', 'cta'];

// Phrase ranges inside other sections that are also shown as big type.
export const SUBTITLE_MUTED_PHRASES: Array<{ section: SectionId; from: string }> = [
  { section: 'generator', from: 'Structured.' },
  { section: 'export', from: 'Fifteen formats.' },
];
