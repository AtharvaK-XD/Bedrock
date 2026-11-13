/** Pure layout for TemplateThumb: scales node positions into a small box. */

/** Colour of each node type in the small previews (same family as the canvas minimap). */
export const NODE_DOT_COLORS: Record<string, string> = {
  system: '#60a5fa',
  prompt: '#ff9b71',
  output: '#34d399',
  data: '#c084fc',
  condition: '#fbbf24',
  code: '#fb7185',
  merge: '#2dd4bf',
  evaluation: '#818cf8',
  note: '#facc15',
  switch: '#fb923c',
  forEach: '#38bdf8',
  arrayTools: '#a3e635',
  jsonPick: '#e879f9',
  variable: '#22d3ee',
  askInput: '#f472b6',
};

export interface ThumbNode {
  id: string;
  position?: { x: number; y: number };
  data?: { nodeType?: string };
}
export interface ThumbEdge {
  source: string;
  target: string;
}

export interface ThumbLayout {
  boxes: { id: string; x: number; y: number; color: string; note: boolean }[];
  wires: { d: string }[];
}

export const BOX_W = 26;
export const BOX_H = 12;

/** Scales the node positions into a small box. Pure, so it is tested. */
export function layoutThumb(nodes: ThumbNode[], edges: ThumbEdge[], width: number, height: number, pad = 10): ThumbLayout {
  const placed = nodes.filter((n) => n && n.position);
  if (placed.length === 0) return { boxes: [], wires: [] };
  const xs = placed.map((n) => n.position!.x);
  const ys = placed.map((n) => n.position!.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(1, Math.max(...xs) - minX);
  const spanY = Math.max(1, Math.max(...ys) - minY);
  const innerW = width - pad * 2 - BOX_W;
  const innerH = height - pad * 2 - BOX_H;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = pad + (innerW - spanX * scale) / 2;
  const offY = pad + (innerH - spanY * scale) / 2;
  const at = new Map<string, { x: number; y: number }>();
  const boxes = placed.map((n) => {
    const x = offX + (n.position!.x - minX) * scale;
    const y = offY + (n.position!.y - minY) * scale;
    at.set(n.id, { x, y });
    const type = n.data?.nodeType ?? 'prompt';
    return { id: n.id, x, y, color: NODE_DOT_COLORS[type] ?? '#9ca3af', note: type === 'note' };
  });
  const wires = edges
    .map((e) => {
      const a = at.get(e.source);
      const b = at.get(e.target);
      if (!a || !b) return null;
      const x1 = a.x + BOX_W;
      const y1 = a.y + BOX_H / 2;
      const x2 = b.x;
      const y2 = b.y + BOX_H / 2;
      const mid = (x1 + x2) / 2;
      return { d: `M${x1.toFixed(1)},${y1.toFixed(1)} C${mid.toFixed(1)},${y1.toFixed(1)} ${mid.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}` };
    })
    .filter((w): w is { d: string } => w !== null);
  return { boxes, wires };
}
