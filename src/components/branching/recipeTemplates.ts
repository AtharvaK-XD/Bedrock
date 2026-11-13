import type { BranchingTemplate } from './beginnerTemplates';

/**
 * "Recipes": ready-made workflows that show off what the Branching page can do, from 4-step prompt builders that fit
 * the Free plan to 10-step pipelines with paths, loops, lists, JSON and a quality gate. Every one uses the free model,
 * runs with "Run all", and starts with a sticky note that says how it works (notes do not count toward the limit).
 */

export interface RecipeTemplate extends BranchingTemplate {
  /** Simple fits the Free plan (5 steps), Intermediate and Advanced need more steps */
  level: 'Simple' | 'Intermediate' | 'Advanced';
  /** What it shows off, e.g. ["Ask Me", "Switch"] */
  shows: string[];
}

const FREE_AGENT = 'gemini';
const FREE_MODEL = 'gemini-3.5-flash-lite';

type Extra = Record<string, unknown> & { description?: string };

const node = (id: string, x: number, y: number, nodeType: string, title: string, extra: Extra = {}) => ({
  id,
  type: 'genericNode',
  position: { x, y },
  data: {
    title,
    description: '',
    agentId: FREE_AGENT,
    modelId: FREE_MODEL,
    nodeType,
    status: 'idle',
    ...extra,
  },
});

const note = (id: string, x: number, y: number, text: string, color: 'yellow' | 'blue' | 'green' | 'pink' = 'yellow') =>
  node(id, x, y, 'note', 'Note', { noteText: text, noteColor: color });

const wire = (id: string, source: string, target: string, sourceHandle?: string) => ({
  id,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
  animated: true,
  type: 'deletableEdge',
  style: { stroke: '#ff9b71', strokeWidth: 2 },
});

/** Counts the steps that count toward a plan's limit (sticky notes do not). */
export function stepCount(tpl: { nodes: { data: { nodeType?: string } }[] }): number {
  return tpl.nodes.filter((n) => n.data.nodeType !== 'note').length;
}

export type TemplateLevel = 'Starter' | 'Simple' | 'Intermediate' | 'Advanced';
export const TEMPLATE_LEVELS: TemplateLevel[] = ['Starter', 'Simple', 'Intermediate', 'Advanced'];

/** Level used by the gallery filter: recipes say it, starters are "Starter", the older templates map from complexity. */
export function levelOf(tpl: BranchingTemplate & { level?: string }): TemplateLevel {
  if (tpl.level === 'Simple' || tpl.level === 'Intermediate' || tpl.level === 'Advanced') return tpl.level;
  if (tpl.category === 'Starter') return 'Starter';
  if (tpl.complexity === 'Advanced') return 'Advanced';
  if (tpl.complexity === 'Intermediate') return 'Intermediate';
  return 'Simple';
}

/**
 * Whether a template fits a plan's step limit, and if not, the smallest plan it fits.
 * `limits` is the dagNodeLimit of each plan (read from TIER_LIMITS by the page).
 */
export function planFit(steps: number, plan: 'free' | 'pro' | 'ultimate', limits: Record<'free' | 'pro' | 'ultimate', number>): { fits: boolean; needs?: 'Pro' | 'Ultimate' } {
  if (steps <= limits[plan]) return { fits: true };
  if (plan === 'free' && steps <= limits.pro) return { fits: false, needs: 'Pro' };
  return { fits: false, needs: 'Ultimate' };
}

// Columns fit a 300px node plus its wires; rows leave room for a node that is showing its result
const X = (col: number) => 60 + col * 380;
const Y = (row: number) => 80 + row * 310;

export const RECIPE_TEMPLATES: RecipeTemplate[] = [
  // ------------------------------------------------------------------------------------------------- Simple (≤ 5)
  {
    id: 'recipe-idea-to-prompt',
    title: 'Idea to build-ready prompt',
    description: 'Type a rough app idea when it asks. A senior engineer persona turns it into a prompt you can paste into any AI coding tool.',
    category: 'Prompt Building',
    tag: 'ASK + PROMPT',
    complexity: 'Beginner',
    level: 'Simple',
    shows: ['Ask Me', 'Persona'],
    archetypes: ['askInput', 'system', 'prompt', 'output'],
    nodes: [
      note('itp-note', X(0), Y(-1) + 40, 'Press Run all. It asks for your idea, then writes the prompt. Try: "an app that reminds me to water my plants".'),
      node('itp-ask', X(0), Y(0), 'askInput', 'Your idea', { askQuestion: 'What do you want to build?', askDefault: 'A habit tracker that sends a friendly nudge every evening', description: 'Asks you for the idea' }),
      node('itp-persona', X(0), Y(1), 'system', 'Senior Product Engineer', {
        description: 'You are a senior product engineer. You write precise, build-ready specs that an AI coding tool can follow without asking questions.',
      }),
      node('itp-prompt', X(1), Y(0), 'prompt', 'Write the prompt', {
        description:
          'Turn the idea above into one build-ready prompt with these headings: Goal, Users, Core features (max 6), Screens, Data model, Tech stack (suggest one), Acceptance criteria. Keep it under 300 words.',
      }),
      node('itp-out', X(2), Y(0), 'output', 'Your build-ready prompt', { description: 'Copy this into your AI coding tool.', outputFormat: 'markdown' }),
    ],
    edges: [wire('itp-e1', 'itp-ask', 'itp-prompt'), wire('itp-e2', 'itp-persona', 'itp-prompt'), wire('itp-e3', 'itp-prompt', 'itp-out')],
  },
  {
    id: 'recipe-prompt-polisher',
    title: 'Prompt polisher',
    description: 'Paste a messy prompt. It comes back clear and structured, and a Quality Judge scores how clear it is.',
    category: 'Prompt Building',
    tag: 'JUDGE',
    complexity: 'Beginner',
    level: 'Simple',
    shows: ['Ask Me', 'Quality Judge'],
    archetypes: ['askInput', 'system', 'prompt', 'evaluation', 'output'],
    nodes: [
      note('pp-note', X(1), Y(-1) + 40, 'The judge gives a score out of 100. Not happy? Edit the "Polish" step and press Run all again.', 'blue'),
      node('pp-ask', X(0), Y(0), 'askInput', 'Your rough prompt', { askQuestion: 'Paste the prompt you want to improve', askDefault: 'make me a website for my bakery with menu and stuff', description: 'Asks for your prompt' }),
      node('pp-persona', X(0), Y(1), 'system', 'Prompt Engineer', { description: 'You are an expert prompt engineer. You keep the author\'s intent and make prompts specific, structured and unambiguous.' }),
      node('pp-polish', X(1), Y(0), 'prompt', 'Polish', {
        description: 'Rewrite the prompt above as a clear prompt with: Role, Context, Task, Constraints, Output format. Fill sensible gaps and mark assumptions with (assumed).',
      }),
      node('pp-judge', X(2), Y(1), 'evaluation', 'How clear is it?', { description: 'Scores clarity from 0 to 100', evalCriteria: 'clarity' }),
      node('pp-out', X(2), Y(0), 'output', 'Polished prompt', { description: 'Your improved prompt', outputFormat: 'markdown' }),
    ],
    edges: [
      wire('pp-e1', 'pp-ask', 'pp-polish'),
      wire('pp-e2', 'pp-persona', 'pp-polish'),
      wire('pp-e3', 'pp-polish', 'pp-out'),
      wire('pp-e4', 'pp-polish', 'pp-judge'),
    ],
  },
  {
    id: 'recipe-name-my-startup',
    title: 'Name my startup',
    description: 'Describe your startup and get eight name ideas, split into a numbered list by List Tools and For Each. No code needed.',
    category: 'Ideas',
    tag: 'LIST',
    complexity: 'Beginner',
    level: 'Simple',
    shows: ['Ask Me', 'List Tools', 'For Each'],
    archetypes: ['askInput', 'prompt', 'arrayTools', 'forEach', 'output'],
    nodes: [
      note('name-note', X(1), Y(-1) + 40, 'List Tools turns the AI\'s lines into a real list. For Each then numbers every name: no extra AI calls.', 'green'),
      node('name-ask', X(0), Y(0), 'askInput', 'What does it do?', { askQuestion: 'What does your startup do, in one sentence?', askDefault: 'Dog walkers on demand for busy city people' }),
      node('name-ideas', X(1), Y(0), 'prompt', 'Brainstorm names', {
        description: 'Suggest 8 short, brandable names for the startup above. One name per line. No numbers, no explanations.',
      }),
      node('name-split', X(2), Y(0), 'arrayTools', 'Make a list', { arrayOp: 'split_lines', arrayArg: '', description: 'One item per line' }),
      node('name-each', X(3), Y(0), 'forEach', 'Number them', { forEachMode: 'template', forEachTemplate: '{{index}}. {{item}}', description: 'Numbers every name' }),
      node('name-out', X(4), Y(0), 'output', 'Name ideas', { description: 'Your shortlist', outputFormat: 'text' }),
    ],
    edges: [wire('name-e1', 'name-ask', 'name-ideas'), wire('name-e2', 'name-ideas', 'name-split'), wire('name-e3', 'name-split', 'name-each'), wire('name-e4', 'name-each', 'name-out')],
  },
  {
    id: 'recipe-email-tone-fixer',
    title: 'Email tone fixer',
    description: 'An angry email goes in, a calm and polite one comes out, and a judge checks it reads clearly.',
    category: 'Writing',
    tag: 'REWRITE',
    complexity: 'Beginner',
    level: 'Simple',
    shows: ['Data', 'Persona', 'Quality Judge'],
    archetypes: ['data', 'system', 'prompt', 'evaluation', 'output'],
    nodes: [
      note('tone-note', X(0), Y(-1) + 40, 'Paste your own email into "Angry draft" (click it, then edit the payload).', 'pink'),
      node('tone-draft', X(0), Y(0), 'data', 'Angry draft', {
        dataMode: 'kv',
        dataPayload:
          'Hi Sam,\nThis is the THIRD time the report is late. I am honestly fed up. If it is not on my desk by tomorrow I will take this to your manager.\nRavi',
        description: 'The email to fix',
      }),
      node('tone-persona', X(0), Y(1), 'system', 'Calm Team Lead', { description: 'You are a calm, kind team lead. You are direct about problems but never rude, and you suggest a next step.' }),
      node('tone-rewrite', X(1), Y(0), 'prompt', 'Rewrite it', { description: 'Rewrite this email so it is polite and calm but still clear about the deadline. Keep it under 120 words.' }),
      node('tone-judge', X(2), Y(1), 'evaluation', 'Clear and kind?', { evalCriteria: 'clarity', description: 'Scores the new email' }),
      node('tone-out', X(2), Y(0), 'output', 'Calm email', { description: 'Ready to send', outputFormat: 'text' }),
    ],
    edges: [
      wire('tone-e1', 'tone-draft', 'tone-rewrite'),
      wire('tone-e2', 'tone-persona', 'tone-rewrite'),
      wire('tone-e3', 'tone-rewrite', 'tone-out'),
      wire('tone-e4', 'tone-rewrite', 'tone-judge'),
    ],
  },
  {
    id: 'recipe-bug-to-checklist',
    title: 'Bug report to checklist',
    description: 'A messy bug report becomes JSON, Pick from JSON takes the steps, and For Each turns them into a checklist.',
    category: 'Engineering',
    tag: 'JSON',
    complexity: 'Beginner',
    level: 'Simple',
    shows: ['Answer as JSON', 'Pick from JSON', 'For Each'],
    archetypes: ['data', 'prompt', 'jsonPick', 'forEach', 'output'],
    nodes: [
      note('bug-note', X(1), Y(-1) + 40, '"Answer as JSON" is switched on in the Prompt, so the next step can read fields such as steps or severity.', 'blue'),
      node('bug-report', X(0), Y(0), 'data', 'Bug report', {
        dataMode: 'kv',
        dataPayload: 'checkout broken again?? clicked pay with card, spinner forever, refreshed and got charged twice. chrome on mac. happened yesterday too after the update',
        description: 'Paste a bug report',
      }),
      node('bug-json', X(1), Y(0), 'prompt', 'Structure it', {
        responseFormat: 'json',
        description:
          'Read the bug report and return JSON with: "title" (short), "severity" ("low", "medium" or "high"), "steps" (array of steps a developer should take to reproduce and fix it, max 6).',
      }),
      node('bug-pick', X(2), Y(0), 'jsonPick', 'Take the steps', { jsonPath: 'steps', jsonFallback: '', description: 'Reads the steps list' }),
      node('bug-each', X(3), Y(0), 'forEach', 'Checklist', { forEachMode: 'template', forEachTemplate: '[ ] {{item}}', description: 'One checkbox per step' }),
      node('bug-out', X(4), Y(0), 'output', 'Fix checklist', { description: 'Paste into your tracker', outputFormat: 'text' }),
    ],
    edges: [wire('bug-e1', 'bug-report', 'bug-json'), wire('bug-e2', 'bug-json', 'bug-pick'), wire('bug-e3', 'bug-pick', 'bug-each'), wire('bug-e4', 'bug-each', 'bug-out')],
  },

  // ------------------------------------------------------------------------------------------------- Intermediate (6–7)
  {
    id: 'recipe-mood-router',
    title: 'Mood router',
    description: 'Tell it how you feel. A Switch sends you down one of four paths, and only that path runs.',
    category: 'Routing',
    tag: 'SWITCH',
    complexity: 'Intermediate',
    level: 'Intermediate',
    shows: ['Ask Me', 'Switch'],
    archetypes: ['askInput', 'switch', 'prompt', 'prompt', 'prompt', 'output'],
    nodes: [
      note('mood-note', X(1), Y(-1) + 40, 'Use "Step" instead of Run all to watch the Switch choose a path. The other paths fade out.', 'green'),
      node('mood-ask', X(0), Y(1), 'askInput', 'How are you?', { askQuestion: 'How are you feeling today? (happy, sad, stressed...)', askDefault: 'a bit stressed about exams' }),
      node('mood-switch', X(1), Y(1), 'switch', 'Which mood?', {
        switchField: '',
        switchCases: [
          { id: 'happy', label: 'Happy', op: 'contains', value: 'happy' },
          { id: 'sad', label: 'Sad', op: 'contains', value: 'sad' },
          { id: 'stress', label: 'Stressed', op: 'contains', value: 'stress' },
        ],
        description: 'First matching case wins',
      }),
      node('mood-happy', X(2), Y(0), 'prompt', 'Celebrate', { description: 'The person feels good. Suggest 3 small ways to make the most of a great day. Keep it short and upbeat.' }),
      node('mood-sad', X(2), Y(1), 'prompt', 'Comfort', { description: 'The person feels down. Reply warmly in 3 sentences and suggest one gentle thing to do today.' }),
      node('mood-stress', X(2), Y(2), 'prompt', 'Calm down', { description: 'The person is stressed. Give a 4-step calming plan they can do in 10 minutes.' }),
      node('mood-out', X(3), Y(1), 'output', 'For you', { description: 'Shows the path that ran', outputFormat: 'markdown' }),
    ],
    edges: [
      wire('mood-e1', 'mood-ask', 'mood-switch'),
      wire('mood-e2', 'mood-switch', 'mood-happy', 'case:happy'),
      wire('mood-e3', 'mood-switch', 'mood-sad', 'case:sad'),
      wire('mood-e4', 'mood-switch', 'mood-stress', 'case:stress'),
      wire('mood-e5', 'mood-switch', 'mood-sad', 'default'),
      wire('mood-e6', 'mood-happy', 'mood-out'),
      wire('mood-e7', 'mood-sad', 'mood-out'),
      wire('mood-e8', 'mood-stress', 'mood-out'),
    ],
  },
  {
    id: 'recipe-product-factory',
    title: 'Product description factory',
    description: 'A list of products goes in. For Each asks the AI once per product, and List Tools joins the results into one page.',
    category: 'Marketing',
    tag: 'FOR EACH (AI)',
    complexity: 'Intermediate',
    level: 'Intermediate',
    shows: ['List Tools', 'For Each (AI)', 'Persona'],
    archetypes: ['data', 'arrayTools', 'system', 'forEach', 'arrayTools', 'output'],
    nodes: [
      note('pf-note', X(2), Y(-1) + 40, 'For Each in "Ask the AI" mode makes one AI call per item. The Free plan uses up to 5 items per run.', 'yellow'),
      node('pf-list', X(0), Y(0), 'data', 'Products', { dataMode: 'kv', dataPayload: 'Bamboo toothbrush\nInsulated steel bottle\nWool desk mat\nLinen tote bag', description: 'One product per line' }),
      node('pf-split', X(1), Y(0), 'arrayTools', 'One per line', { arrayOp: 'split_lines', arrayArg: '' }),
      node('pf-persona', X(1), Y(1), 'system', 'Copywriter', { description: 'You are a warm, concrete e-commerce copywriter. No buzzwords, no exclamation marks.' }),
      node('pf-each', X(2), Y(0), 'forEach', 'Describe each', {
        forEachMode: 'ai',
        forEachTemplate: 'Write a 2-sentence product description for "{{item}}". Start with the benefit.',
      }),
      node('pf-join', X(3), Y(0), 'arrayTools', 'Join into a page', { arrayOp: 'join', arrayArg: '\\n\\n' }),
      node('pf-out', X(4), Y(0), 'output', 'Descriptions', { description: 'All descriptions', outputFormat: 'markdown' }),
    ],
    edges: [
      wire('pf-e1', 'pf-list', 'pf-split'),
      wire('pf-e2', 'pf-split', 'pf-each'),
      wire('pf-e3', 'pf-persona', 'pf-each'),
      wire('pf-e4', 'pf-each', 'pf-join'),
      wire('pf-e5', 'pf-join', 'pf-out'),
    ],
  },
  {
    id: 'recipe-meeting-tasks',
    title: 'Meeting notes to task table',
    description: 'Notes become a JSON list of tasks. One branch counts them, the other writes "task: owner (due)" lines. Open the result viewer for a table.',
    category: 'Productivity',
    tag: 'TABLE',
    complexity: 'Intermediate',
    level: 'Intermediate',
    shows: ['Answer as JSON', 'For Each {{item.field}}', 'List Tools count'],
    archetypes: ['data', 'prompt', 'forEach', 'output', 'arrayTools', 'output'],
    nodes: [
      note('mt-note', X(1), Y(-1) + 40, 'Click "View" on "Extract tasks" after a run: the Table tab shows one row per task.', 'blue'),
      node('mt-notes', X(0), Y(0), 'data', 'Meeting notes', {
        dataMode: 'kv',
        dataPayload:
          'Launch sync, Monday.\nAisha will finish the onboarding emails by Thursday.\nMarco to fix the signup bug before Wednesday.\nWe still need someone to update the pricing page, Lee said he can do it next week.\nEveryone: test the beta on your phone.',
      }),
      node('mt-json', X(1), Y(0), 'prompt', 'Extract tasks', {
        responseFormat: 'json',
        description: 'List every task in these notes as a JSON array of objects with "task", "owner" and "due". Use "unassigned" or "no date" when missing.',
      }),
      node('mt-lines', X(2), Y(0), 'forEach', 'Task lines', { forEachMode: 'template', forEachTemplate: '{{index}}. {{item.task}}: {{item.owner}} ({{item.due}})' }),
      node('mt-out', X(3), Y(0), 'output', 'Tasks', { outputFormat: 'text', description: 'One line per task' }),
      node('mt-count', X(2), Y(1), 'arrayTools', 'How many?', { arrayOp: 'count', arrayArg: '' }),
      node('mt-count-out', X(3), Y(1), 'output', 'Number of tasks', { outputFormat: 'text', description: 'Task count' }),
    ],
    edges: [
      wire('mt-e1', 'mt-notes', 'mt-json'),
      wire('mt-e2', 'mt-json', 'mt-lines'),
      wire('mt-e3', 'mt-lines', 'mt-out'),
      wire('mt-e4', 'mt-json', 'mt-count'),
      wire('mt-e5', 'mt-count', 'mt-count-out'),
    ],
  },
  {
    id: 'recipe-pick-the-price',
    title: 'Pick the price',
    description: 'Pick from JSON reads the best price, a number rule decides if it is a deal, and the matching message is written.',
    category: 'Shopping',
    tag: 'NUMBER RULE',
    complexity: 'Intermediate',
    level: 'Intermediate',
    shows: ['Pick from JSON', 'Smart rules (numbers)'],
    archetypes: ['data', 'jsonPick', 'condition', 'prompt', 'prompt', 'output'],
    nodes: [
      note('price-note', X(2), Y(-1) + 40, 'Change the price in "Offers" to 45 and press Run all: the other path runs.', 'yellow'),
      node('price-data', X(0), Y(1), 'data', 'Offers', {
        dataMode: 'json',
        dataPayload: JSON.stringify({ product: 'Desk lamp', offers: [{ shop: 'Bright & Co', price: 24 }, { shop: 'LampWorld', price: 31 }] }, null, 2),
      }),
      node('price-pick', X(1), Y(1), 'jsonPick', 'Best price', { jsonPath: 'offers[0].price', jsonFallback: '' }),
      node('price-check', X(2), Y(1), 'condition', 'Under 30?', {
        conditionRule: 'contains',
        conditionValue: '',
        conditionGroup: { mode: 'all', rules: [{ field: '', op: 'num_lt', value: '30' }] },
        description: 'TRUE when the price is below 30',
      }),
      node('price-deal', X(3), Y(0), 'prompt', 'Deal message', { description: 'The desk lamp costs the price above. Write a short, excited message telling a friend it is a great deal.' }),
      node('price-wait', X(3), Y(2), 'prompt', 'Wait message', { description: 'The desk lamp costs the price above, which is more than our budget of 30. Write a short message suggesting we wait for a sale.' }),
      node('price-out', X(4), Y(1), 'output', 'Message', { outputFormat: 'text' }),
    ],
    edges: [
      wire('price-e1', 'price-data', 'price-pick'),
      wire('price-e2', 'price-pick', 'price-check'),
      wire('price-e3', 'price-check', 'price-deal', 'true'),
      wire('price-e4', 'price-check', 'price-wait', 'false'),
      wire('price-e5', 'price-deal', 'price-out'),
      wire('price-e6', 'price-wait', 'price-out'),
    ],
  },
  {
    id: 'recipe-two-sides',
    title: 'Two sides debate',
    description: 'Ask a question. One AI argues for, one argues against, and a Merge step writes a fair verdict from both.',
    category: 'Thinking',
    tag: 'VARIABLE + MERGE',
    complexity: 'Intermediate',
    level: 'Intermediate',
    shows: ['Variable', 'Parallel paths', 'Merge (AI)'],
    archetypes: ['askInput', 'variable', 'prompt', 'prompt', 'merge', 'output'],
    nodes: [
      note('deb-note', X(1), Y(-1) + 40, 'The Variable saves your question as {{vars.question}}, so both sides can use it without extra wires.', 'pink'),
      node('deb-ask', X(0), Y(1), 'askInput', 'The question', { askQuestion: 'What should the two sides debate?', askDefault: 'Should a small startup build a mobile app first or a website first?' }),
      node('deb-var', X(1), Y(1), 'variable', 'Save question', { variableName: 'question' }),
      node('deb-for', X(2), Y(0), 'prompt', 'Argue FOR', { description: 'Argue strongly FOR the first option in this question, in 4 bullet points: {{vars.question}}' }),
      node('deb-against', X(2), Y(2), 'prompt', 'Argue AGAINST', { description: 'Argue strongly for the OTHER option in this question, in 4 bullet points: {{vars.question}}' }),
      node('deb-merge', X(3), Y(1), 'merge', 'Fair verdict', { mergeStrategy: 'synthesize', description: 'Writes a balanced verdict' }),
      node('deb-out', X(4), Y(1), 'output', 'Verdict', { outputFormat: 'markdown' }),
    ],
    edges: [
      wire('deb-e1', 'deb-ask', 'deb-var'),
      wire('deb-e2', 'deb-var', 'deb-for'),
      wire('deb-e3', 'deb-var', 'deb-against'),
      wire('deb-e4', 'deb-for', 'deb-merge'),
      wire('deb-e5', 'deb-against', 'deb-merge'),
      wire('deb-e6', 'deb-merge', 'deb-out'),
    ],
  },

  // ------------------------------------------------------------------------------------------------- Advanced (8–10)
  {
    id: 'recipe-support-triage',
    title: 'Customer support triage',
    description: 'The AI labels a message as bug, billing or feature. A Switch sends it to the right reply writer; anything else gets a friendly default.',
    category: 'Support',
    tag: 'SWITCH x4',
    complexity: 'Advanced',
    level: 'Advanced',
    shows: ['Switch', '{{node.id}}', 'Default path'],
    archetypes: ['data', 'prompt', 'switch', 'prompt', 'prompt', 'prompt', 'prompt', 'output'],
    nodes: [
      note('st-note', X(2), Y(-1) + 40, 'Each reply writer reads the original message with {{node.st-msg}}, not the one-word label.', 'blue'),
      node('st-msg', X(0), Y(1) + 60, 'data', 'Customer message', {
        dataMode: 'kv',
        dataPayload: 'Hi, I was charged twice for my Pro plan this month. Can you refund one of them? Thanks, Mei',
      }),
      node('st-label', X(1), Y(1) + 60, 'prompt', 'Label it', { description: 'Label this customer message with exactly one word: bug, billing, feature or other.' }),
      node('st-switch', X(2), Y(1) + 60, 'switch', 'Route', {
        switchField: '',
        switchCases: [
          { id: 'bug', label: 'Bug', op: 'contains', value: 'bug' },
          { id: 'billing', label: 'Billing', op: 'contains', value: 'billing' },
          { id: 'feature', label: 'Feature', op: 'contains', value: 'feature' },
        ],
      }),
      node('st-bug', X(3), Y(0), 'prompt', 'Bug reply', { description: 'Write a short, caring reply to this bug report. Ask for one missing detail.\n\nMessage: {{node.st-msg}}' }),
      node('st-billing', X(3), Y(1), 'prompt', 'Billing reply', { description: 'Write a short reply to this billing question. Promise a check within 2 working days.\n\nMessage: {{node.st-msg}}' }),
      node('st-feature', X(3), Y(2), 'prompt', 'Feature reply', { description: 'Thank the customer for this idea in 3 sentences and say it was shared with the team.\n\nMessage: {{node.st-msg}}' }),
      node('st-other', X(3), Y(3), 'prompt', 'Friendly default', { description: 'Write a warm, short reply to this message and offer help.\n\nMessage: {{node.st-msg}}' }),
      node('st-out', X(4), Y(1) + 60, 'output', 'Reply to send', { outputFormat: 'text' }),
    ],
    edges: [
      wire('st-e1', 'st-msg', 'st-label'),
      wire('st-e2', 'st-label', 'st-switch'),
      wire('st-e3', 'st-switch', 'st-bug', 'case:bug'),
      wire('st-e4', 'st-switch', 'st-billing', 'case:billing'),
      wire('st-e5', 'st-switch', 'st-feature', 'case:feature'),
      wire('st-e6', 'st-switch', 'st-other', 'default'),
      wire('st-e7', 'st-bug', 'st-out'),
      wire('st-e8', 'st-billing', 'st-out'),
      wire('st-e9', 'st-feature', 'st-out'),
      wire('st-e10', 'st-other', 'st-out'),
    ],
  },
  {
    id: 'recipe-features-to-prompts',
    title: 'App idea to feature prompts',
    description: 'One app idea becomes five build-ready prompts, one per feature: list the features, keep the top five, write a prompt for each, then judge the set.',
    category: 'Prompt Building',
    tag: 'LOOP + VARS',
    complexity: 'Advanced',
    level: 'Advanced',
    shows: ['Variable', 'List Tools', 'For Each (AI)', 'Quality Judge'],
    archetypes: ['askInput', 'variable', 'prompt', 'arrayTools', 'arrayTools', 'forEach', 'arrayTools', 'evaluation', 'output'],
    nodes: [
      note('fp-note', X(2), Y(-1) + 40, 'This is how Bedrock thinks: one idea, split into features, one build-ready prompt per feature.', 'green'),
      node('fp-ask', X(0), Y(0), 'askInput', 'Your app idea', { askQuestion: 'Describe your app idea in one sentence', askDefault: 'A shared grocery list for flatmates that splits the bill' }),
      node('fp-var', X(1), Y(0), 'variable', 'Remember the idea', { variableName: 'app' }),
      node('fp-list', X(2), Y(0), 'prompt', 'List features', { description: 'List 7 core features for this app: {{vars.app}}\nOne feature per line, 3 to 6 words each, no numbers.' }),
      node('fp-split', X(3), Y(0), 'arrayTools', 'Split', { arrayOp: 'split_lines', arrayArg: '' }),
      node('fp-top', X(4), Y(0), 'arrayTools', 'Keep top 5', { arrayOp: 'take', arrayArg: '5' }),
      node('fp-each', X(4), Y(1), 'forEach', 'Prompt per feature', {
        forEachMode: 'ai',
        forEachTemplate:
          'Write a build-ready prompt for the feature "{{item}}" in this app: {{vars.app}}.\nInclude: user story, screen layout, data needed, edge cases, acceptance criteria. Max 150 words. Start with "Feature {{index}}: {{item}}".',
      }),
      node('fp-join', X(3), Y(1), 'arrayTools', 'Join', { arrayOp: 'join', arrayArg: '\\n\\n---\\n\\n' }),
      node('fp-judge', X(2), Y(2), 'evaluation', 'Ready to build?', { evalCriteria: 'clarity' }),
      node('fp-out', X(2), Y(1), 'output', 'Feature prompts', { outputFormat: 'markdown' }),
    ],
    edges: [
      wire('fp-e1', 'fp-ask', 'fp-var'),
      wire('fp-e2', 'fp-var', 'fp-list'),
      wire('fp-e3', 'fp-list', 'fp-split'),
      wire('fp-e4', 'fp-split', 'fp-top'),
      wire('fp-e5', 'fp-top', 'fp-each'),
      wire('fp-e6', 'fp-each', 'fp-join'),
      wire('fp-e7', 'fp-join', 'fp-out'),
      wire('fp-e8', 'fp-join', 'fp-judge'),
    ],
  },
  {
    id: 'recipe-blog-quality-gate',
    title: 'Blog post with a quality gate',
    description: 'Outline, draft, judge. If the score is 70 or more it is approved; if not, an editor rewrites it using the judge\'s feedback.',
    category: 'Writing',
    tag: 'JUDGE GATE',
    complexity: 'Advanced',
    level: 'Advanced',
    shows: ['Variable', 'Quality Judge', 'Smart rules (score)', '{{node.id}}'],
    archetypes: ['askInput', 'variable', 'prompt', 'prompt', 'output', 'evaluation', 'condition', 'output', 'prompt', 'output'],
    nodes: [
      note('bq-note', X(3), Y(-1) + 40, 'The If/Else uses a smart rule: "judge score is at least 70". Only one of its two paths runs.', 'yellow'),
      node('bq-ask', X(0), Y(0), 'askInput', 'Topic', { askQuestion: 'What should the blog post be about?', askDefault: 'Why small teams should write things down' }),
      node('bq-var', X(1), Y(0), 'variable', 'Save topic', { variableName: 'topic' }),
      node('bq-outline', X(2), Y(0), 'prompt', 'Outline', { description: 'Write a 5-point outline for a blog post about {{vars.topic}}. One line per point.' }),
      node('bq-draft', X(3), Y(0), 'prompt', 'Draft', { description: 'Write a 350-word blog post that follows this outline. Friendly, concrete, one example per point.' }),
      node('bq-post', X(4), Y(0), 'output', 'Draft post', { outputFormat: 'markdown' }),
      node('bq-judge', X(3), Y(1) + 60, 'evaluation', 'Judge', { evalCriteria: 'clarity' }),
      node('bq-gate', X(4), Y(1) + 60, 'condition', 'Good enough?', {
        conditionRule: 'contains',
        conditionValue: '',
        conditionGroup: { mode: 'all', rules: [{ field: '', op: 'score_gte', value: '70' }] },
        description: 'TRUE when the judge gives 70 or more',
      }),
      node('bq-approved', X(5), Y(0) + 40, 'output', 'Approved', { outputFormat: 'text', description: 'Shows the judge\'s verdict' }),
      node('bq-edit', X(5), Y(2) + 20, 'prompt', 'Editor rewrite', {
        description: 'Improve this blog post using the judge feedback. Keep the structure, fix what the feedback says.\n\nFeedback: {{node.bq-judge}}\n\nPost:\n{{node.bq-draft}}',
      }),
      node('bq-final', X(6), Y(2) + 20, 'output', 'Improved post', { outputFormat: 'markdown' }),
    ],
    edges: [
      wire('bq-e1', 'bq-ask', 'bq-var'),
      wire('bq-e2', 'bq-var', 'bq-outline'),
      wire('bq-e3', 'bq-outline', 'bq-draft'),
      wire('bq-e4', 'bq-draft', 'bq-post'),
      wire('bq-e5', 'bq-draft', 'bq-judge'),
      wire('bq-e6', 'bq-judge', 'bq-gate'),
      wire('bq-e7', 'bq-gate', 'bq-approved', 'true'),
      wire('bq-e8', 'bq-gate', 'bq-edit', 'false'),
      wire('bq-e9', 'bq-edit', 'bq-final'),
    ],
  },
  {
    id: 'recipe-fridge-taste-test',
    title: 'Fridge recipe taste test',
    description: 'Say what is in your fridge. A chef writes a recipe, a judge scores it, and a Switch sorts it into great, okay, or "simplify it".',
    category: 'Fun',
    tag: 'SCORE SWITCH',
    complexity: 'Advanced',
    level: 'Advanced',
    shows: ['Ask Me', 'Quality Judge', 'Switch on a score'],
    archetypes: ['askInput', 'system', 'prompt', 'evaluation', 'switch', 'output', 'output', 'prompt', 'output'],
    nodes: [
      note('fr-note', X(3), Y(-1) + 40, 'A Switch can check the judge score too: 85+ is great, 60+ is okay, anything else gets simplified.', 'pink'),
      node('fr-ask', X(0), Y(1), 'askInput', 'Your fridge', { askQuestion: 'What is in your fridge?', askDefault: 'eggs, spinach, half an onion, feta, leftover rice' }),
      node('fr-chef', X(0), Y(2), 'system', 'Home Chef', { description: 'You are a practical home chef. Recipes use only what is listed plus salt, pepper and oil. 20 minutes max.' }),
      node('fr-recipe', X(1), Y(1), 'prompt', 'Recipe', { description: 'Write a recipe with a fun name, ingredients and up to 6 numbered steps.' }),
      node('fr-judge', X(2), Y(1), 'evaluation', 'Taste test', { evalCriteria: 'clarity' }),
      node('fr-switch', X(3), Y(1), 'switch', 'How good?', {
        switchField: '',
        switchCases: [
          { id: 'great', label: 'Great', op: 'score_gte', value: '85' },
          { id: 'okay', label: 'Okay', op: 'score_gte', value: '60' },
        ],
      }),
      node('fr-great', X(4), Y(0), 'output', 'Chef\'s kiss', { outputFormat: 'text', description: 'Score 85 or more' }),
      node('fr-okay', X(4), Y(1), 'output', 'Good enough', { outputFormat: 'text', description: 'Score 60 to 84' }),
      node('fr-simplify', X(4), Y(2), 'prompt', 'Simplify it', { description: 'Rewrite this recipe so a beginner can follow it: fewer steps, plainer words.\n\nRecipe:\n{{node.fr-recipe}}' }),
      node('fr-final', X(5), Y(2), 'output', 'Simpler recipe', { outputFormat: 'markdown' }),
    ],
    edges: [
      wire('fr-e1', 'fr-ask', 'fr-recipe'),
      wire('fr-e2', 'fr-chef', 'fr-recipe'),
      wire('fr-e3', 'fr-recipe', 'fr-judge'),
      wire('fr-e4', 'fr-judge', 'fr-switch'),
      wire('fr-e5', 'fr-switch', 'fr-great', 'case:great'),
      wire('fr-e6', 'fr-switch', 'fr-okay', 'case:okay'),
      wire('fr-e7', 'fr-switch', 'fr-simplify', 'default'),
      wire('fr-e8', 'fr-simplify', 'fr-final'),
    ],
  },
  {
    id: 'recipe-code-review-gate',
    title: 'Code review gate',
    description: 'A strict reviewer returns issues as JSON. List Tools keeps the high-severity ones, and a list rule decides: fix list, or approval.',
    category: 'Engineering',
    tag: 'LIST RULE',
    complexity: 'Advanced',
    level: 'Advanced',
    shows: ['Answer as JSON', 'List Tools filter', 'Smart rules (lists)', 'For Each {{item.field}}'],
    archetypes: ['data', 'system', 'prompt', 'arrayTools', 'condition', 'forEach', 'output', 'prompt', 'output'],
    nodes: [
      note('cr-note', X(3), Y(-1) + 40, 'The If/Else rule is "is a list with more than 0 items": any high-severity issue blocks the release.', 'blue'),
      node('cr-code', X(0), Y(1), 'data', 'Code to review', {
        dataMode: 'kv',
        dataPayload: "app.get('/user', (req, res) => {\n  const q = \"SELECT * FROM users WHERE id = \" + req.query.id;\n  db.query(q).then(rows => res.send(rows));\n});",
      }),
      node('cr-persona', X(0), Y(2), 'system', 'Strict Reviewer', { description: 'You are a strict senior code reviewer focused on security and correctness.' }),
      node('cr-review', X(1), Y(1), 'prompt', 'Review', {
        responseFormat: 'json',
        description: 'Review the code. Return JSON: {"issues": [{"severity": "high" | "medium" | "low", "text": "what is wrong and how to fix it"}]}.',
      }),
      node('cr-high', X(2), Y(1), 'arrayTools', 'Only high', { arrayOp: 'filter', arrayArg: 'high' }),
      node('cr-gate', X(3), Y(1), 'condition', 'Any blockers?', {
        conditionRule: 'contains',
        conditionValue: '',
        conditionGroup: { mode: 'all', rules: [{ field: '', op: 'array_length_gt', value: '0' }] },
      }),
      node('cr-fixes', X(4), Y(0), 'forEach', 'Fix list', { forEachMode: 'template', forEachTemplate: '{{index}}. {{item.text}}' }),
      node('cr-fix-out', X(5), Y(0), 'output', 'Must fix before release', { outputFormat: 'text' }),
      node('cr-ok', X(4), Y(2), 'prompt', 'Approval note', { description: 'There are no high-severity issues. Write one short sentence approving this change for release.' }),
      node('cr-ok-out', X(5), Y(2), 'output', 'Approved', { outputFormat: 'text' }),
    ],
    edges: [
      wire('cr-e1', 'cr-code', 'cr-review'),
      wire('cr-e2', 'cr-persona', 'cr-review'),
      wire('cr-e3', 'cr-review', 'cr-high'),
      wire('cr-e4', 'cr-high', 'cr-gate'),
      wire('cr-e5', 'cr-gate', 'cr-fixes', 'true'),
      wire('cr-e6', 'cr-gate', 'cr-ok', 'false'),
      wire('cr-e7', 'cr-fixes', 'cr-fix-out'),
      wire('cr-e8', 'cr-ok', 'cr-ok-out'),
    ],
  },
];
