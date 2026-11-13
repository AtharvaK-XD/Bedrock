import { Braces, ListFilter, MessageCircleQuestion, Repeat, Signpost, Variable } from 'lucide-react';
import type { ArrayOp, ConditionOp, SwitchCase, WorkflowNodeData } from '../../lib/workflowEngine';

/**
 * The six Branching v2 node types that only the workflow engine knows how to run
 * (src/lib/workflowEngine/runner.ts): their look in the palette and on the canvas, their starting settings,
 * and plain-English names for every rule and list operation.
 */

export const V2_NODE_TYPES = ['switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput'] as const;
export type V2NodeType = (typeof V2_NODE_TYPES)[number];

export function isV2NodeType(type: string | undefined): type is V2NodeType {
  return Boolean(type && (V2_NODE_TYPES as readonly string[]).includes(type));
}

/** Same shape as the page's NODE_CONFIG entries, so they can sit next to the original 8. */
export const V2_NODE_CONFIG = {
  switch: {
    title: 'Switch',
    desc: 'Many paths: the first matching case wins, otherwise "default"',
    tag: 'SWITCH',
    color: 'text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-400/35',
    hoverBorder: 'hover:border-orange-400/65',
    icon: Signpost,
    paletteShape: 'rounded-lg rounded-tr-2xl',
  },
  forEach: {
    title: 'For Each',
    desc: 'Repeats a step for every item in a list',
    tag: 'LOOP',
    color: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-400/35',
    hoverBorder: 'hover:border-sky-400/65',
    icon: Repeat,
    paletteShape: 'rounded-full rounded-br-md',
  },
  arrayTools: {
    title: 'List Tools',
    desc: 'Split, filter, sort, take, count or join a list',
    tag: 'LIST',
    color: 'text-lime-300',
    bg: 'bg-lime-500/10',
    border: 'border-lime-400/35',
    hoverBorder: 'hover:border-lime-400/65',
    icon: ListFilter,
    paletteShape: 'rounded-md',
  },
  jsonPick: {
    title: 'Pick from JSON',
    desc: 'Reads one value out of JSON by its path',
    tag: 'PICK',
    color: 'text-fuchsia-300',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-400/35',
    hoverBorder: 'hover:border-fuchsia-400/65',
    icon: Braces,
    paletteShape: 'rounded-xl rounded-tl-sm',
  },
  variable: {
    title: 'Variable',
    desc: 'Saves the text under a name for later steps',
    tag: 'VAR',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-400/35',
    hoverBorder: 'hover:border-cyan-400/65',
    icon: Variable,
    paletteShape: 'rounded-md rounded-bl-2xl',
  },
  askInput: {
    title: 'Ask Me',
    desc: 'Asks you a question while the workflow runs',
    tag: 'ASK',
    color: 'text-pink-300',
    bg: 'bg-pink-500/10',
    border: 'border-pink-400/35',
    hoverBorder: 'hover:border-pink-400/65',
    icon: MessageCircleQuestion,
    paletteShape: 'rounded-2xl rounded-bl-sm',
  },
};

let caseCounter = 0;
/** Short, stable id for a switch case (used in the wire handle id `case:<id>`). */
export function newCaseId(): string {
  caseCounter = (caseCounter + 1) % 1000;
  return `c${Date.now().toString(36).slice(-4)}${caseCounter}`;
}

/** Starting settings for a new node of each v2 type: they run as they are, so a beginner sees something work. */
export function v2Defaults(type: V2NodeType): Partial<WorkflowNodeData> {
  switch (type) {
    case 'switch':
      return {
        title: 'Switch',
        description: 'Send the input down the first matching path',
        switchField: '',
        switchCases: [
          { id: newCaseId(), label: 'Happy', op: 'contains', value: 'happy' },
          { id: newCaseId(), label: 'Sad', op: 'contains', value: 'sad' },
        ],
      };
    case 'forEach':
      return {
        title: 'For Each',
        description: 'Repeat for every item',
        forEachMode: 'template',
        forEachTemplate: '{{index}}. {{item}}',
      };
    case 'arrayTools':
      return { title: 'List Tools', description: 'Turn text into a list', arrayOp: 'split_lines', arrayArg: '' };
    case 'jsonPick':
      return { title: 'Pick from JSON', description: 'Read one value', jsonPath: 'items[0]', jsonFallback: '' };
    case 'variable':
      return { title: 'Variable', description: 'Remember this for later', variableName: 'topic' };
    case 'askInput':
      return { title: 'Ask Me', description: 'A question for you when it runs', askQuestion: 'What topic should I use?', askDefault: '' };
  }
}

/** The data a v2 node needs to be useful, used by the canvas summary. */
export function summarizeV2(data: Partial<WorkflowNodeData>): string {
  switch (data.nodeType) {
    case 'switch': {
      const cases = (data.switchCases as SwitchCase[] | undefined) ?? [];
      return cases.length ? `${cases.length} ${cases.length === 1 ? 'case' : 'cases'} + default` : 'No cases yet';
    }
    case 'forEach':
      return data.forEachMode === 'ai' ? 'Asks the AI once per item' : 'Fills a template for each item';
    case 'arrayTools': {
      const op = ARRAY_OP_INFO.find((o) => o.id === data.arrayOp) ?? ARRAY_OP_INFO[0];
      return op.needsArg && data.arrayArg ? `${op.label}: ${data.arrayArg}` : op.label;
    }
    case 'jsonPick':
      return data.jsonPath ? `Reads ${data.jsonPath}` : 'No path set';
    case 'variable':
      return data.variableName ? `Saved as {{vars.${data.variableName}}}` : 'No name set';
    case 'askInput':
      return data.askQuestion ? `"${data.askQuestion}"` : 'No question set';
    default:
      return '';
  }
}

/** True when this node must run through the engine (the original Run button only knows the first 8 types). */
export function needsEngine(data: Partial<WorkflowNodeData>): boolean {
  if (isV2NodeType(data.nodeType)) return true;
  if (data.nodeType === 'condition' && data.conditionGroup && Array.isArray(data.conditionGroup.rules) && data.conditionGroup.rules.length > 0) return true;
  if (data.nodeType === 'prompt' && data.responseFormat === 'json') return true;
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Plain-English names

export interface OpInfo {
  id: ConditionOp;
  label: string;
  /** Group heading in the dropdown */
  group: 'Text' | 'Numbers' | 'Lists' | 'Shape' | 'Quality Judge';
  /** What the value box should say; undefined means the rule needs no value */
  valueHint?: string;
}

export const CONDITION_OP_INFO: OpInfo[] = [
  { id: 'contains', label: 'contains', group: 'Text', valueHint: 'word or phrase' },
  { id: 'not_contains', label: 'does not contain', group: 'Text', valueHint: 'word or phrase' },
  { id: 'equals', label: 'is exactly', group: 'Text', valueHint: 'text' },
  { id: 'not_equals', label: 'is not', group: 'Text', valueHint: 'text' },
  { id: 'starts_with', label: 'starts with', group: 'Text', valueHint: 'text' },
  { id: 'ends_with', label: 'ends with', group: 'Text', valueHint: 'text' },
  { id: 'regex', label: 'matches the pattern', group: 'Text', valueHint: 'pattern, e.g. ^yes' },
  { id: 'length_gt', label: 'is longer than (characters)', group: 'Text', valueHint: 'number' },
  { id: 'length_lt', label: 'is shorter than (characters)', group: 'Text', valueHint: 'number' },
  { id: 'num_gt', label: 'is more than', group: 'Numbers', valueHint: 'number' },
  { id: 'num_gte', label: 'is at least', group: 'Numbers', valueHint: 'number' },
  { id: 'num_lt', label: 'is less than', group: 'Numbers', valueHint: 'number' },
  { id: 'num_lte', label: 'is at most', group: 'Numbers', valueHint: 'number' },
  { id: 'num_eq', label: 'equals the number', group: 'Numbers', valueHint: 'number' },
  { id: 'between', label: 'is between', group: 'Numbers', valueHint: 'low,high e.g. 10,20' },
  { id: 'array_length_gt', label: 'is a list with more than', group: 'Lists', valueHint: 'number of items' },
  { id: 'array_length_lt', label: 'is a list with fewer than', group: 'Lists', valueHint: 'number of items' },
  { id: 'array_includes', label: 'is a list that includes', group: 'Lists', valueHint: 'item' },
  { id: 'is_empty', label: 'is empty', group: 'Shape' },
  { id: 'not_empty', label: 'is not empty', group: 'Shape' },
  { id: 'is_json', label: 'is valid JSON', group: 'Shape' },
  { id: 'is_array', label: 'is a list', group: 'Shape' },
  { id: 'score_gte', label: 'judge score is at least', group: 'Quality Judge', valueHint: '0-100' },
  { id: 'score_lt', label: 'judge score is below', group: 'Quality Judge', valueHint: '0-100' },
];

export function opInfo(op: ConditionOp | undefined): OpInfo {
  return CONDITION_OP_INFO.find((o) => o.id === op) ?? CONDITION_OP_INFO[0];
}

export interface ArrayOpInfo {
  id: ArrayOp;
  label: string;
  help: string;
  needsArg: boolean;
  argHint?: string;
}

export const ARRAY_OP_INFO: ArrayOpInfo[] = [
  { id: 'split_lines', label: 'Split into lines', help: 'One item per line. Bullets and numbers are removed.', needsArg: false },
  { id: 'split_by', label: 'Split by a separator', help: 'Cuts the text wherever the separator appears.', needsArg: true, argHint: 'separator, e.g. ,' },
  { id: 'filter', label: 'Keep only items that…', help: 'Type a word to keep matching items, !word to drop them, or > 10 for numbers.', needsArg: true, argHint: 'e.g. urgent, !spam, > 10' },
  { id: 'sort', label: 'Sort', help: 'A to Z, or smallest first. Type "desc" for the other way round.', needsArg: true, argHint: 'asc or desc' },
  { id: 'take', label: 'Keep the first N', help: 'Keeps the first few items.', needsArg: true, argHint: 'how many, e.g. 3' },
  { id: 'unique', label: 'Remove repeats', help: 'Drops items that appear more than once.', needsArg: false },
  { id: 'count', label: 'Count the items', help: 'Gives back how many items there are.', needsArg: false },
  { id: 'join', label: 'Join into text', help: 'Puts the items back together with a separator.', needsArg: true, argHint: 'separator, e.g. , or \\n' },
  { id: 'pluck', label: 'Pick a field from each', help: 'For a list of objects: keeps one field of each.', needsArg: true, argHint: 'field, e.g. name' },
  { id: 'reverse', label: 'Reverse the order', help: 'Last item first.', needsArg: false },
];

// ---------------------------------------------------------------------------------------------------------------------
// Canvas look (kept next to the page's getShapeClasses style: tinted gradient body, coloured border, glow when selected)

const V2_SHAPES: Record<V2NodeType, { body: string; on: string; off: string; header: string; footer: string }> = {
  switch: {
    body: 'w-[300px] rounded-xl rounded-tr-[26px] border bg-gradient-to-b from-orange-950/40 via-sf-120f0d/95 to-sf-0c0906/95',
    on: 'border-orange-300 shadow-[0_0_35px_rgba(251,146,60,0.3)] ring-1 ring-orange-300/50',
    off: 'border-orange-400/35 hover:border-orange-400/65 shadow-[0_4px_25px_rgba(251,146,60,0.12)]',
    header: 'rounded-tl-xl rounded-tr-[25px] bg-orange-500/10 border-orange-500/20',
    footer: 'rounded-b-xl',
  },
  forEach: {
    body: 'w-[290px] rounded-[22px] rounded-br-lg border bg-gradient-to-b from-sky-950/40 via-sf-0e121b/95 to-sf-0b0e14/95',
    on: 'border-sky-300 shadow-[0_0_35px_rgba(56,189,248,0.3)] ring-1 ring-sky-300/50',
    off: 'border-sky-400/35 hover:border-sky-400/65 shadow-[0_4px_25px_rgba(56,189,248,0.12)]',
    header: 'rounded-t-[21px] bg-sky-500/10 border-sky-500/20',
    footer: 'rounded-bl-[21px] rounded-br-lg',
  },
  arrayTools: {
    body: 'w-[280px] rounded-lg border bg-gradient-to-b from-lime-950/30 via-sf-0b1712/95 to-sf-050b08/95',
    on: 'border-lime-300 shadow-[0_0_35px_rgba(163,230,53,0.25)] ring-1 ring-lime-300/50',
    off: 'border-lime-400/35 hover:border-lime-400/65 shadow-[0_4px_25px_rgba(163,230,53,0.1)]',
    header: 'rounded-t-lg bg-lime-500/10 border-lime-500/20',
    footer: 'rounded-b-lg',
  },
  jsonPick: {
    body: 'w-[280px] rounded-2xl rounded-tl-md border bg-gradient-to-b from-fuchsia-950/30 via-sf-0d0914/95 to-sf-0b0714/95',
    on: 'border-fuchsia-300 shadow-[0_0_35px_rgba(232,121,249,0.25)] ring-1 ring-fuchsia-300/50',
    off: 'border-fuchsia-400/35 hover:border-fuchsia-400/65 shadow-[0_4px_25px_rgba(232,121,249,0.1)]',
    header: 'rounded-tr-2xl rounded-tl-md bg-fuchsia-500/10 border-fuchsia-500/20',
    footer: 'rounded-b-2xl',
  },
  variable: {
    body: 'w-[270px] rounded-lg rounded-bl-[24px] border bg-gradient-to-b from-cyan-950/30 via-sf-0a1318/95 to-sf-071514/95',
    on: 'border-cyan-300 shadow-[0_0_35px_rgba(34,211,238,0.25)] ring-1 ring-cyan-300/50',
    off: 'border-cyan-400/35 hover:border-cyan-400/65 shadow-[0_4px_25px_rgba(34,211,238,0.1)]',
    header: 'rounded-t-lg bg-cyan-500/10 border-cyan-500/20',
    footer: 'rounded-br-lg rounded-bl-[23px]',
  },
  askInput: {
    body: 'w-[280px] rounded-[24px] rounded-bl-md border bg-gradient-to-b from-pink-950/30 via-sf-120d09/95 to-sf-0d0914/95',
    on: 'border-pink-300 shadow-[0_0_35px_rgba(244,114,182,0.25)] ring-1 ring-pink-300/50',
    off: 'border-pink-400/35 hover:border-pink-400/65 shadow-[0_4px_25px_rgba(244,114,182,0.1)]',
    header: 'rounded-t-[23px] bg-pink-500/10 border-pink-500/20',
    footer: 'rounded-br-[23px] rounded-bl-md',
  },
};

export function v2ShapeClasses(type: string, selected: boolean): string | null {
  if (!isV2NodeType(type)) return null;
  const s = V2_SHAPES[type];
  return `${s.body} ${selected ? s.on : s.off}`;
}

export function v2HeaderClasses(type: string): string | null {
  return isV2NodeType(type) ? V2_SHAPES[type].header : null;
}

export function v2FooterClasses(type: string): string | null {
  return isV2NodeType(type) ? V2_SHAPES[type].footer : null;
}

/** Colour of each Switch case dot, in order (the "default" dot is grey). */
export const CASE_COLORS = ['#fb923c', '#38bdf8', '#a3e635', '#f472b6', '#facc15', '#c084fc', '#2dd4bf', '#f87171'];
export const MAX_SWITCH_CASES = CASE_COLORS.length;

/**
 * Paths a person can click to pick from a JSON result, e.g. ["title", "items", "items[0]", "items[0].name"].
 * Two levels deep, first array item only, at most `max` paths. Returns [] for text that is not JSON.
 */
export function listJsonPaths(text: string | undefined, max = 14): string[] {
  if (!text || !text.trim()) return [];
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }
  const out: string[] = [];
  const walk = (v: unknown, prefix: string, depth: number) => {
    if (out.length >= max || depth > 2) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      const p = `${prefix}[0]`;
      out.push(p);
      walk(v[0], p, depth + 1);
      return;
    }
    if (v && typeof v === 'object') {
      for (const key of Object.keys(v as Record<string, unknown>)) {
        if (out.length >= max) return;
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) continue;
        const p = prefix ? `${prefix}.${key}` : key;
        out.push(p);
        walk((v as Record<string, unknown>)[key], p, depth + 1);
      }
    }
  };
  walk(value, '', 0);
  return out;
}

/** Engine tier for a website plan; the desktop app uses its own keys, so it runs as "ultimate". */
export function engineTierFor(plan: string, desktop: boolean): 'free' | 'pro' | 'ultimate' {
  if (desktop) return 'ultimate';
  if (plan === 'ultimate') return 'ultimate';
  if (plan === 'free') return 'free';
  return 'pro';
}

/** Node types whose run calls the AI (used to check keys and plan models before a run). */
export function usesAI(data: Partial<WorkflowNodeData>): boolean {
  switch (data.nodeType) {
    case 'prompt':
    case 'evaluation':
      return true;
    case 'merge':
      return data.mergeStrategy === 'synthesize';
    case 'forEach':
      return data.forEachMode === 'ai';
    default:
      return false;
  }
}
