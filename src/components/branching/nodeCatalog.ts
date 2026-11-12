/**
 * Plain-English description of every Branching node type. It powers the palette tooltips, the search box,
 * the guided tour, the help cards and the "How to fix" line under a failed node.
 *
 * All 15 node types are listed (the 8 original ones plus the 7 from the Branching v2 plan). A type is only
 * offered in the palette when `available` is true; the others switch on when their UI ships (Part B).
 */

export type CatalogNodeType =
  | 'system'
  | 'prompt'
  | 'output'
  | 'data'
  | 'condition'
  | 'code'
  | 'merge'
  | 'evaluation'
  | 'switch'
  | 'forEach'
  | 'arrayTools'
  | 'jsonPick'
  | 'variable'
  | 'askInput'
  | 'note';

export type PaletteGroupId = 'start' | 'think' | 'decide' | 'lists' | 'finish';

export interface NodeCatalogEntry {
  id: CatalogNodeType;
  name: string;
  emoji: string;
  /** One sentence: what this node does. */
  does: string;
  /** What goes into it. */
  goesIn: string;
  /** What comes out of it. */
  comesOut: string;
  /** A tiny example, in words. */
  example: string;
  /** Good nodes to connect after this one. */
  nextNodes: CatalogNodeType[];
  group: PaletteGroupId;
  /** Extra words the palette search also matches ("if" finds Decide, "list" finds List Tools). */
  keywords: string[];
  /** One line shown under a failed node of this type. */
  howToFix: string;
  /** True when the node can be added from the palette today. */
  available: boolean;
}

export const PALETTE_GROUPS: { id: PaletteGroupId; label: string; hint: string }[] = [
  { id: 'start', label: 'Start', hint: 'Where your information comes from' },
  { id: 'think', label: 'Think (AI)', hint: 'Let an AI write or judge something' },
  { id: 'decide', label: 'Decide', hint: 'Send the answer down different paths' },
  { id: 'lists', label: 'Lists and data', hint: 'Combine, reshape or run small scripts' },
  { id: 'finish', label: 'Finish', hint: 'Show the result, or leave a note' },
];

export const NODE_CATALOG: Record<CatalogNodeType, NodeCatalogEntry> = {
  system: {
    id: 'system',
    name: 'Persona',
    emoji: '🎭',
    does: 'Tells the AI who it should be and how to behave, for every AI step after it.',
    goesIn: 'Nothing. You type the rules.',
    comesOut: 'The persona text, handed to the AI nodes it is connected to.',
    example: '"You are a friendly teacher. Explain things simply."',
    nextNodes: ['prompt'],
    group: 'start',
    keywords: ['persona', 'role', 'system', 'rules', 'tone', 'style'],
    howToFix: 'Write at least one sentence of rules in the node settings.',
    available: true,
  },
  data: {
    id: 'data',
    name: 'Data',
    emoji: '🗂️',
    does: 'Holds text or JSON you paste in, such as your notes, a customer email or a product list.',
    goesIn: 'Nothing. You paste the information.',
    comesOut: 'The same text (JSON is tidied up), ready for the next node.',
    example: 'Your meeting notes, pasted as plain text.',
    nextNodes: ['prompt', 'code'],
    group: 'start',
    keywords: ['data', 'input', 'notes', 'paste', 'json', 'text', 'document'],
    howToFix: 'Paste your text or JSON into the data box in the node settings.',
    available: true,
  },
  askInput: {
    id: 'askInput',
    name: 'Ask Me',
    emoji: '🙋',
    does: 'Pauses the workflow and asks you a question when it runs.',
    goesIn: 'Nothing. You type the question to ask.',
    comesOut: 'Whatever you answer.',
    example: 'Question: "Which topic should I write about?"',
    nextNodes: ['prompt', 'variable'],
    group: 'start',
    keywords: ['ask', 'question', 'input', 'prompt user', 'form'],
    howToFix: 'Type your answer in the box that appears, or press Skip to use the default.',
    available: false,
  },
  prompt: {
    id: 'prompt',
    name: 'Prompt',
    emoji: '💬',
    does: 'Sends your instruction to an AI model and gives back its answer.',
    goesIn: 'Your instruction, plus anything connected before it (text, data, a persona).',
    comesOut: 'The AI\'s answer as text.',
    example: '"Explain this like I am five."',
    nextNodes: ['output', 'condition', 'evaluation'],
    group: 'think',
    keywords: ['ai', 'ask', 'llm', 'model', 'write', 'generate', 'gpt', 'prompt', 'chat'],
    howToFix: 'Check the instruction is not empty and the model is allowed on your plan. If it mentions a limit or a key, see the message above.',
    available: true,
  },
  evaluation: {
    id: 'evaluation',
    name: 'Quality Judge',
    emoji: '⚖️',
    does: 'Asks an AI to grade the text it receives from 0 to 100 and explain why.',
    goesIn: 'The text you want graded.',
    comesOut: 'A score and a short comment.',
    example: 'Score: 86/100. "Clear and correct, but a little long."',
    nextNodes: ['condition', 'output'],
    group: 'think',
    keywords: ['judge', 'score', 'grade', 'quality', 'evaluate', 'review', 'rate'],
    howToFix: 'Connect something that produces text (a Prompt, for example) into the judge and run that first.',
    available: true,
  },
  forEach: {
    id: 'forEach',
    name: 'For Each',
    emoji: '🔁',
    does: 'Repeats a step for every item in a list, and collects the results as a new list.',
    goesIn: 'A list.',
    comesOut: 'A list with one result per item.',
    example: 'For each product name, write one slogan.',
    nextNodes: ['arrayTools', 'output'],
    group: 'lists',
    keywords: ['loop', 'each', 'repeat', 'every', 'list', 'for'],
    howToFix: 'The step before it must produce a list. Try a List Tools node set to "split into lines".',
    available: false,
  },
  condition: {
    id: 'condition',
    name: 'If / Else',
    emoji: '🔀',
    does: 'Checks the text it receives and sends it down the TRUE path or the FALSE path.',
    goesIn: 'Text from the step before it.',
    comesOut: 'The same text, on the path that matched.',
    example: 'If the answer contains "positive", go TRUE, otherwise FALSE.',
    nextNodes: ['output', 'prompt'],
    group: 'decide',
    keywords: ['if', 'else', 'branch', 'decide', 'condition', 'true', 'false', 'check', 'compare'],
    howToFix: 'Run the step before it first, then check the word or number you are testing for.',
    available: true,
  },
  switch: {
    id: 'switch',
    name: 'Switch',
    emoji: '🚦',
    does: 'Like If / Else, but with many paths: the first rule that matches wins, otherwise "default".',
    goesIn: 'Text from the step before it.',
    comesOut: 'The same text, on the path that matched.',
    example: 'Mood is happy, sad or angry: each goes somewhere different.',
    nextNodes: ['prompt', 'output'],
    group: 'decide',
    keywords: ['switch', 'many', 'multiple', 'paths', 'route', 'case', 'if'],
    howToFix: 'Add at least one case, and connect the "default" dot for everything that does not match.',
    available: false,
  },
  code: {
    id: 'code',
    name: 'Script',
    emoji: '🧪',
    does: 'Runs a small piece of JavaScript on the text it receives, in a locked sandbox.',
    goesIn: 'Text from the step before it (called "input" in the code).',
    comesOut: 'Whatever your code returns.',
    example: 'Turn "a, b, c" into a list of three items.',
    nextNodes: ['output', 'prompt'],
    group: 'lists',
    keywords: ['code', 'script', 'javascript', 'js', 'transform', 'extract', 'list', 'format'],
    howToFix: 'Your code must end with `return` and a value. If you chose not to allow custom code, run it again and press OK.',
    available: true,
  },
  merge: {
    id: 'merge',
    name: 'Merge',
    emoji: '🧩',
    does: 'Brings several branches together into one piece of text.',
    goesIn: 'Two or more branches.',
    comesOut: 'One combined text (joined, as bullets, as JSON, or summed up by an AI).',
    example: 'A summary and a list of risks, joined into one report.',
    nextNodes: ['output', 'evaluation'],
    group: 'lists',
    keywords: ['merge', 'combine', 'join', 'together', 'collect'],
    howToFix: 'Connect at least two nodes into it and run them first.',
    available: true,
  },
  arrayTools: {
    id: 'arrayTools',
    name: 'List Tools',
    emoji: '📋',
    does: 'Works on a list: split text into items, sort, filter, take the first few, remove repeats or count.',
    goesIn: 'A list, or text you want to turn into one.',
    comesOut: 'A new list (or a number or a joined text).',
    example: 'Take the first 3 lines of your notes.',
    nextNodes: ['forEach', 'output'],
    group: 'lists',
    keywords: ['list', 'array', 'sort', 'filter', 'split', 'first', 'unique', 'count', 'join'],
    howToFix: 'Check the step before it gives a list, or choose "split into lines" first.',
    available: false,
  },
  jsonPick: {
    id: 'jsonPick',
    name: 'Pick from JSON',
    emoji: '🎯',
    does: 'Reads one value out of JSON by its path.',
    goesIn: 'JSON text.',
    comesOut: 'The one value you picked.',
    example: 'items[0].title gives the title of the first item.',
    nextNodes: ['prompt', 'condition'],
    group: 'lists',
    keywords: ['json', 'pick', 'path', 'field', 'value', 'extract'],
    howToFix: 'Check the input is valid JSON and the path matches its field names, for example items[0].title.',
    available: false,
  },
  variable: {
    id: 'variable',
    name: 'Variable',
    emoji: '🏷️',
    does: 'Saves what it receives under a name, so any later node can use it as {{vars.name}}.',
    goesIn: 'Any text.',
    comesOut: 'The same text, saved for later.',
    example: 'Save the customer name, use it again at the end.',
    nextNodes: ['prompt', 'output'],
    group: 'lists',
    keywords: ['variable', 'save', 'name', 'remember', 'store'],
    howToFix: 'Use a short name with letters, numbers and underscores only.',
    available: false,
  },
  output: {
    id: 'output',
    name: 'Output',
    emoji: '🖥️',
    does: 'Shows the final result. Copy it, download it or open it in the viewer.',
    goesIn: 'Text from the step before it.',
    comesOut: 'The same text, ready to read and copy.',
    example: 'The finished answer, at the end of your pipeline.',
    nextNodes: [],
    group: 'finish',
    keywords: ['output', 'result', 'show', 'end', 'finish', 'final', 'display', 'terminal'],
    howToFix: 'Connect a node into it and run that node first.',
    available: true,
  },
  note: {
    id: 'note',
    name: 'Sticky Note',
    emoji: '📝',
    does: 'A comment on the canvas for you or your team. It never runs and does not count toward your node limit.',
    goesIn: 'Nothing.',
    comesOut: 'Nothing.',
    example: '"Step 1: paste the customer email here."',
    nextNodes: [],
    group: 'finish',
    keywords: ['note', 'comment', 'sticky', 'label', 'remember', 'text'],
    howToFix: 'Notes never fail. They are just text.',
    available: true,
  },
};

export const ALL_NODE_TYPES = Object.keys(NODE_CATALOG) as CatalogNodeType[];

export function getCatalogEntry(type: string | undefined): NodeCatalogEntry | null {
  if (!type) return null;
  return (NODE_CATALOG as Record<string, NodeCatalogEntry>)[type] ?? null;
}

/** Entries that can be added today, grouped for the palette in the order of PALETTE_GROUPS. */
export function getPaletteGroups(): { group: (typeof PALETTE_GROUPS)[number]; entries: NodeCatalogEntry[] }[] {
  return PALETTE_GROUPS.map((group) => ({
    group,
    entries: ALL_NODE_TYPES.map((t) => NODE_CATALOG[t]).filter((e) => e.group === group.id && e.available),
  })).filter((g) => g.entries.length > 0);
}

/**
 * How well an entry matches a search. Lower is better: an exact name first, then a name that starts with the
 * words, then a name that contains them, then the keywords, and last the description.
 * (So typing "note" finds Sticky Note before Data, whose keywords also mention "notes".)
 */
function matchScore(entry: NodeCatalogEntry, q: string): number {
  const name = entry.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (entry.keywords.some((k) => k === q)) return 3;
  if (entry.keywords.some((k) => k.startsWith(q))) return 4;
  if (entry.keywords.some((k) => k.includes(q))) return 5;
  if (entry.does.toLowerCase().includes(q)) return 6;
  return Infinity;
}

/** Palette search: matches the name, the keywords and the one-line description, best match first. */
export function searchCatalog(query: string, onlyAvailable = true): NodeCatalogEntry[] {
  const q = query.trim().toLowerCase();
  const pool = ALL_NODE_TYPES.map((t) => NODE_CATALOG[t]).filter((e) => !onlyAvailable || e.available);
  if (!q) return pool;
  return pool
    .map((entry, order) => ({ entry, order, score: matchScore(entry, q) }))
    .filter((r) => r.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map((r) => r.entry);
}
