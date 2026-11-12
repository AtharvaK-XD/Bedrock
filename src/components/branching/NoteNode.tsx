import { cn } from '../../lib/utils';
import { NOTE_COLORS, NOTE_MAX_CHARS, type NoteColor } from './noteColors';

interface NoteNodeProps {
  data: { noteText?: string; noteColor?: NoteColor };
  selected: boolean;
  onChange: (patch: { noteText?: string; noteColor?: NoteColor }) => void;
}

/**
 * Sticky Note: a comment on the canvas. It has no wires and no Run button, and never takes part in a run.
 * The note's text lives in `noteText`, its colour in `noteColor`.
 */
export function NoteNode({ data, selected, onChange }: NoteNodeProps) {
  const color = NOTE_COLORS.find((c) => c.id === data.noteColor) ?? NOTE_COLORS[0];
  return (
    <div
      className={cn(
        'w-[240px] rounded-xl border backdrop-blur-md shadow-xl p-3 flex flex-col gap-2 transition-shadow select-none',
        color.card,
        selected && 'ring-2 ring-white/40 shadow-2xl'
      )}
    >
      <textarea
        value={data.noteText ?? ''}
        onChange={(e) => onChange({ noteText: e.target.value.slice(0, NOTE_MAX_CHARS) })}
        placeholder="Write a note..."
        aria-label="Sticky note text"
        rows={4}
        // nodrag/nowheel: typing and scrolling inside the note must not move the canvas
        className="nodrag nowheel w-full resize-none bg-transparent text-[13px] leading-relaxed placeholder-white/40 focus:outline-none custom-scrollbar select-text"
      />
      <div className="flex items-center justify-between nodrag">
        <div className="flex items-center gap-1.5" role="group" aria-label="Note colour">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange({ noteColor: c.id })}
              aria-label={`${c.label} note`}
              aria-pressed={c.id === color.id}
              className={cn(
                'w-4 h-4 rounded-full border transition-transform hover:scale-110',
                c.dot,
                c.id === color.id ? 'border-white ring-1 ring-white/60 scale-110' : 'border-black/30'
              )}
            />
          ))}
        </div>
        <span className="text-[9px] font-mono opacity-50">{(data.noteText ?? '').length}/{NOTE_MAX_CHARS}</span>
      </div>
    </div>
  );
}
