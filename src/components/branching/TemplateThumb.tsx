import { BOX_H, BOX_W, layoutThumb, type ThumbEdge, type ThumbNode } from './thumbLayout';

/** A tiny drawing of a workflow: coloured boxes for steps, curves for wires. Decorative; the card text says the rest. */
export function TemplateThumb({ nodes, edges, width = 240, height = 84, className }: { nodes: ThumbNode[]; edges: ThumbEdge[]; width?: number; height?: number; className?: string }) {
  const { boxes, wires } = layoutThumb(nodes, edges, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {wires.map((w, i) => (
        <path key={i} d={w.d} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.2} />
      ))}
      {boxes.map((b) => (
        <rect
          key={b.id}
          x={b.x}
          y={b.y}
          width={BOX_W}
          height={BOX_H}
          rx={b.note ? 1.5 : 3.5}
          fill={`${b.color}${b.note ? '33' : '2e'}`}
          stroke={b.color}
          strokeOpacity={b.note ? 0.45 : 0.85}
          strokeDasharray={b.note ? '2 2' : undefined}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
