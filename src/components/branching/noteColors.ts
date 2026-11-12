/** Sticky Note colours and limits. */

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink';

export const NOTE_COLORS: { id: NoteColor; label: string; card: string; dot: string }[] = [
  { id: 'yellow', label: 'Yellow', card: 'bg-yellow-400/15 border-yellow-400/40 text-yellow-50', dot: 'bg-yellow-400' },
  { id: 'blue', label: 'Blue', card: 'bg-sky-400/15 border-sky-400/40 text-sky-50', dot: 'bg-sky-400' },
  { id: 'green', label: 'Green', card: 'bg-emerald-400/15 border-emerald-400/40 text-emerald-50', dot: 'bg-emerald-400' },
  { id: 'pink', label: 'Pink', card: 'bg-pink-400/15 border-pink-400/40 text-pink-50', dot: 'bg-pink-400' },
];

export const NOTE_MAX_CHARS = 600;
