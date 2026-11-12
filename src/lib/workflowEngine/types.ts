/**
 * Branching v2 workflow engine: shared types.
 * The contract is agent-sync/BRANCHING_PROMPTS.md section 0. Everything here is additive: the 8 original node types
 * and their fields are unchanged, and a saved workflow without the new fields runs exactly as before.
 */

export type LegacyNodeType = 'system' | 'prompt' | 'output' | 'data' | 'condition' | 'code' | 'merge' | 'evaluation';
export type NewNodeType = 'switch' | 'forEach' | 'arrayTools' | 'jsonPick' | 'variable' | 'askInput' | 'note';
export type WorkflowNodeType = LegacyNodeType | NewNodeType;

export const LEGACY_NODE_TYPES: readonly LegacyNodeType[] = ['system', 'prompt', 'output', 'data', 'condition', 'code', 'merge', 'evaluation'];
export const NEW_NODE_TYPES: readonly NewNodeType[] = ['switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput', 'note'];
export const ALL_NODE_TYPES: readonly WorkflowNodeType[] = [...LEGACY_NODE_TYPES, ...NEW_NODE_TYPES];

export type ConditionOp =
  | 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' | 'regex'
  | 'length_gt' | 'length_lt' | 'is_empty' | 'not_empty' | 'is_json' | 'is_array'
  | 'num_gt' | 'num_gte' | 'num_lt' | 'num_lte' | 'num_eq' | 'between'
  | 'array_length_gt' | 'array_length_lt' | 'array_includes'
  | 'score_gte' | 'score_lt';

export const CONDITION_OPS: readonly ConditionOp[] = [
  'contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'regex',
  'length_gt', 'length_lt', 'is_empty', 'not_empty', 'is_json', 'is_array',
  'num_gt', 'num_gte', 'num_lt', 'num_lte', 'num_eq', 'between',
  'array_length_gt', 'array_length_lt', 'array_includes',
  'score_gte', 'score_lt',
];

export interface ConditionRuleV2 {
  /** JSON path into the input (e.g. `items[0].price`); empty means the whole input */
  field?: string;
  op: ConditionOp;
  value?: string;
}

export interface ConditionGroup {
  mode: 'all' | 'any';
  rules: ConditionRuleV2[];
}

export interface SwitchCase {
  id: string;
  label: string;
  op: ConditionOp;
  value?: string;
}

export type ArrayOp = 'split_lines' | 'split_by' | 'filter' | 'sort' | 'take' | 'unique' | 'count' | 'join' | 'pluck' | 'reverse';
export const ARRAY_OPS: readonly ArrayOp[] = ['split_lines', 'split_by', 'filter', 'sort', 'take', 'unique', 'count', 'join', 'pluck', 'reverse'];

/** Node data: the original fields plus the optional Branching v2 fields. */
export interface WorkflowNodeData {
  title: string;
  description: string;
  agentId?: string;
  modelId?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  nodeType: WorkflowNodeType;
  output?: string;
  // original fields
  systemPersona?: string;
  dataPayload?: string;
  dataMode?: 'json' | 'kv';
  conditionRule?: 'contains' | 'not_contains' | 'length_gt' | 'regex';
  conditionValue?: string;
  conditionResult?: boolean;
  codeScript?: string;
  mergeStrategy?: 'concat' | 'bullets' | 'json' | 'synthesize';
  evalCriteria?: string;
  evalScore?: number;
  evalCritique?: string;
  outputFormat?: 'markdown' | 'text' | 'json';
  // Branching v2
  conditionGroup?: ConditionGroup;
  switchField?: string;
  switchCases?: SwitchCase[];
  forEachMode?: 'template' | 'ai';
  forEachTemplate?: string;
  forEachMaxItems?: number;
  arrayOp?: ArrayOp;
  arrayArg?: string;
  jsonPath?: string;
  jsonFallback?: string;
  variableName?: string;
  askQuestion?: string;
  askDefault?: string;
  noteText?: string;
  noteColor?: 'yellow' | 'blue' | 'green' | 'pink';
  responseFormat?: 'text' | 'json';
  result?: NodeResult;
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: WorkflowNodeData;
  [key: string]: unknown;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  [key: string]: unknown;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type ResultKind = 'text' | 'json' | 'array' | 'number' | 'boolean' | 'empty';

/** One output envelope for every node. `text` always equals what the UI stores in `data.output`. */
export interface NodeResult {
  kind: ResultKind;
  text: string;
  value?: unknown;
  /** condition: 'true' | 'false'; switch: 'case:<id>' | 'default' */
  branch?: string;
  /** Plain-English explanation of a decision (condition, switch), shown in step-by-step mode */
  reason?: string;
  /** Quality Judge score 0-100 when one was found in the judge's answer */
  score?: number;
  skipped?: boolean;
  error?: { code: string; message: string; hint?: string };
  /** Short plain-English remarks, e.g. "Only the first 5 items were used (Free plan)" */
  notes?: string[];
  meta: {
    nodeId: string;
    nodeType: string;
    startedAt: string;
    durationMs: number;
    aiCalls: number;
    model?: string;
    truncated?: boolean;
    itemCount?: number;
  };
}

export type SafeRegexResult = { ok: true; matched: boolean } | { ok: false; reason: 'too_long' | 'invalid' | 'unsafe' };

export interface EngineDeps {
  callAI(modelId: string, system: string, prompt: string, onToken?: (t: string) => void, opts?: { responseFormat?: 'json' }): Promise<string>;
  runCode(script: string, input: string): Promise<string>;
  regexTest(pattern: string, text: string): SafeRegexResult;
  /** Returns the person's answer, or null when they cancel */
  askInput(node: { id: string; question: string; default?: string }): Promise<string | null>;
}

export type EngineTier = 'free' | 'pro' | 'ultimate';

export interface EngineLimits {
  maxAiCalls: number;
  maxForEachItems: number;
  maxNodes: number;
}

export type EngineEvent =
  | { type: 'run-start'; order: string[] }
  | { type: 'node-start'; nodeId: string }
  | { type: 'node-token'; nodeId: string; token: string }
  | { type: 'node-done'; nodeId: string; result: NodeResult }
  | { type: 'node-skipped'; nodeId: string; result: NodeResult }
  | { type: 'node-error'; nodeId: string; result: NodeResult }
  | { type: 'run-done'; summary: RunSummary };

export interface RunOptions {
  deps: EngineDeps;
  tier: EngineTier;
  signal?: AbortSignal;
  /** Run only this node, using the outputs already stored on its upstream nodes */
  only?: string;
  /** Run this node and everything downstream of it */
  startFrom?: string;
  onEvent?: (e: EngineEvent) => void;
  /** Override the plan caps (the desktop app with its own keys, tests) */
  limits?: Partial<EngineLimits>;
}

export interface RunSummary {
  status: 'success' | 'partial' | 'error' | 'cancelled';
  order: string[];
  results: Record<string, NodeResult>;
  aiCalls: number;
  durationMs: number;
  vars: Record<string, string>;
}

export interface GraphIssue {
  severity: 'error' | 'warning' | 'tip';
  code: string;
  nodeId?: string;
  edgeId?: string;
  message: string;
  fix?: string;
}

export interface RunPlan {
  order: string[];
  levels: string[][];
  cycles: string[][];
}
