/**
 * Starter templates for people who have never built a pipeline. Each one has 3 nodes, so it fits the free plan's
 * 3-node limit, and each one works with the free models. They sit next to the original curated templates.
 */

export interface BranchingTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  tag: string;
  complexity: string;
  archetypes: string[];
  nodes: any[];
  edges: any[];
}

const FREE_AGENT = 'gemini';
const FREE_MODEL = 'gemini-3.5-flash-lite';

const edge = (id: string, source: string, target: string, sourceHandle?: string) => ({
  id,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
  animated: true,
  type: 'deletableEdge',
  style: { stroke: '#ff9b71', strokeWidth: 2 },
});

/** Turns a list of lines into a checklist. Shared by the "Make a to-do list" template and the Code node presets. */
export const EXTRACT_LIST_CODE = String.raw`// Turn each line of the input into a checklist item
return input
  .split('\n')
  .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
  .filter(Boolean)
  .map((line) => '[ ] ' + line)
  .join('\n');`;

export const STARTER_TEMPLATE_ID = 'beginner-explain-like-5';

export const BEGINNER_TEMPLATES: BranchingTemplate[] = [
  {
    id: STARTER_TEMPLATE_ID,
    title: "Explain like I'm 5",
    description: 'A friendly teacher persona explains anything in simple words. The easiest first pipeline: change the question and press Run.',
    category: 'Starter',
    tag: 'START HERE',
    complexity: 'Beginner',
    archetypes: ['system', 'prompt', 'output'],
    nodes: [
      {
        id: 'eli5-persona',
        type: 'genericNode',
        position: { x: 80, y: 120 },
        data: {
          title: 'Friendly Teacher',
          description: 'You are a kind teacher talking to a five-year-old. Use very short sentences, simple words and one fun comparison.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'system',
          status: 'idle',
        },
      },
      {
        id: 'eli5-question',
        type: 'genericNode',
        position: { x: 470, y: 120 },
        data: {
          title: 'Your Question',
          description: 'Explain how the internet works.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'prompt',
          status: 'idle',
        },
      },
      {
        id: 'eli5-answer',
        type: 'genericNode',
        position: { x: 860, y: 120 },
        data: {
          title: 'Answer',
          description: 'The explanation appears here.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'output',
          status: 'idle',
          outputFormat: 'markdown',
        },
      },
    ],
    edges: [edge('eli5-e1', 'eli5-persona', 'eli5-question'), edge('eli5-e2', 'eli5-question', 'eli5-answer')],
  },
  {
    id: 'beginner-is-it-positive',
    title: 'Is it positive?',
    description: 'An AI reads a review and answers positive or negative. An if / else step then sends it down the matching path.',
    category: 'Starter',
    tag: 'IF / ELSE',
    complexity: 'Beginner',
    archetypes: ['prompt', 'condition', 'output'],
    nodes: [
      {
        id: 'pos-review',
        type: 'genericNode',
        position: { x: 80, y: 160 },
        data: {
          title: 'Read the Review',
          description:
            'Here is a customer review: "The battery lasts all day and the screen is gorgeous, but it arrived a week late." Is the overall feeling positive or negative? Answer with exactly one word: positive or negative.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'prompt',
          status: 'idle',
        },
      },
      {
        id: 'pos-check',
        type: 'genericNode',
        position: { x: 470, y: 160 },
        data: {
          title: 'Is it positive?',
          description: 'Goes TRUE when the answer contains the word "positive".',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'condition',
          status: 'idle',
          conditionRule: 'contains',
          conditionValue: 'positive',
        },
      },
      {
        id: 'pos-result',
        type: 'genericNode',
        position: { x: 880, y: 160 },
        data: {
          title: 'Result',
          description: 'Shows the answer that came down the matching path.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'output',
          status: 'idle',
          outputFormat: 'text',
        },
      },
    ],
    edges: [
      edge('pos-e1', 'pos-review', 'pos-check'),
      edge('pos-e2', 'pos-check', 'pos-result', 'true'),
      edge('pos-e3', 'pos-check', 'pos-result', 'false'),
    ],
  },
  {
    id: 'beginner-summarise-notes',
    title: 'Summarise my notes',
    description: 'Paste your notes into a Data node. An AI turns them into three bullets and a list of things to do.',
    category: 'Starter',
    tag: 'SUMMARY',
    complexity: 'Beginner',
    archetypes: ['data', 'prompt', 'output'],
    nodes: [
      {
        id: 'sum-notes',
        type: 'genericNode',
        position: { x: 80, y: 130 },
        data: {
          title: 'My Notes',
          description: 'Paste your notes here',
          dataPayload:
            'Meeting with Priya, Tuesday.\nWe agreed to launch the new landing page on the 21st. Sam will finish the pricing copy by Friday.\nOpen question: do we offer a yearly discount? Priya thinks yes, I am not sure.\nNeed to send the invoice to the printer and book the demo room.',
          dataMode: 'kv',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'data',
          status: 'idle',
        },
      },
      {
        id: 'sum-prompt',
        type: 'genericNode',
        position: { x: 470, y: 130 },
        data: {
          title: 'Summarise',
          description: 'Summarise the notes in 3 short bullet points, then list any action items with who owns them.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'prompt',
          status: 'idle',
        },
      },
      {
        id: 'sum-output',
        type: 'genericNode',
        position: { x: 860, y: 130 },
        data: {
          title: 'Summary',
          description: 'Your summary appears here.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'output',
          status: 'idle',
          outputFormat: 'markdown',
        },
      },
    ],
    edges: [edge('sum-e1', 'sum-notes', 'sum-prompt'), edge('sum-e2', 'sum-prompt', 'sum-output')],
  },
  {
    id: 'beginner-todo-list',
    title: 'Make a to-do list',
    description: 'An AI brainstorms tasks, a small script turns them into a tidy checklist. Your first look at the Script node.',
    category: 'Starter',
    tag: 'CHECKLIST',
    complexity: 'Beginner',
    archetypes: ['prompt', 'code', 'output'],
    nodes: [
      {
        id: 'todo-brain',
        type: 'genericNode',
        position: { x: 80, y: 130 },
        data: {
          title: 'Brain Dump',
          description: 'Write 6 things I need to do to prepare for a small birthday party. One item per line, no numbers.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'prompt',
          status: 'idle',
        },
      },
      {
        id: 'todo-script',
        type: 'genericNode',
        position: { x: 470, y: 130 },
        data: {
          title: 'Extract List',
          description: 'Turns each line into a checklist item',
          codeScript: EXTRACT_LIST_CODE,
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'code',
          status: 'idle',
        },
      },
      {
        id: 'todo-output',
        type: 'genericNode',
        position: { x: 860, y: 130 },
        data: {
          title: 'My To-Do List',
          description: 'Your checklist appears here.',
          agentId: FREE_AGENT,
          modelId: FREE_MODEL,
          nodeType: 'output',
          status: 'idle',
          outputFormat: 'text',
        },
      },
    ],
    edges: [edge('todo-e1', 'todo-brain', 'todo-script'), edge('todo-e2', 'todo-script', 'todo-output')],
  },
];
