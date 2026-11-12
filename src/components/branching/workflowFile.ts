/**
 * Export a workflow to a file and read one back.
 *
 * Export drops everything a run produced (outputs, scores, statuses), so a shared file never carries
 * somebody's results. Import only checks the file's shape here. The safety check for what a file may contain
 * (custom code, oversized text, odd fields) is Security's sanitizeWorkflow, so the Import button stays
 * switched off (IMPORT_ENABLED) until that is merged.
 */

export const IMPORT_ENABLED = false;

export const WORKFLOW_FILE_KIND = 'bedrock-workflow';
export const WORKFLOW_FILE_VERSION = 1;
const MAX_FILE_CHARS = 1_000_000;
const MAX_NODES = 200;

export interface WorkflowFile {
  kind: typeof WORKFLOW_FILE_KIND;
  version: number;
  exportedAt: string;
  title: string;
  nodes: unknown[];
  edges: unknown[];
}

const RESULT_FIELDS = ['output', 'result', 'status', 'conditionResult', 'evalScore', 'evalCritique'];

interface ExportNode {
  data?: Record<string, unknown>;
  selected?: boolean;
  [key: string]: unknown;
}

export function buildWorkflowFile(title: string, nodes: ExportNode[], edges: unknown[]): WorkflowFile {
  const cleanNodes = nodes.map((node) => {
    const { selected: _selected, ...rest } = node;
    const data: Record<string, unknown> = { ...(node.data || {}) };
    for (const field of RESULT_FIELDS) delete data[field];
    data.status = 'idle';
    return { ...rest, data };
  });
  return {
    kind: WORKFLOW_FILE_KIND,
    version: WORKFLOW_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    title: title || 'Untitled Pipeline',
    nodes: cleanNodes,
    edges,
  };
}

export function workflowFileName(title: string): string {
  const base = (title || 'workflow').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workflow';
  return `${base}.bedrock-workflow.json`;
}

export type ParsedWorkflowFile = { ok: true; file: WorkflowFile } | { ok: false; message: string };

export function parseWorkflowFile(text: string): ParsedWorkflowFile {
  if (typeof text !== 'string' || text.length === 0) return { ok: false, message: 'The file is empty.' };
  if (text.length > MAX_FILE_CHARS) return { ok: false, message: 'The file is too large to be a workflow.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: "That file isn't valid JSON." };
  }
  const obj = parsed as Partial<WorkflowFile> | null;
  if (!obj || typeof obj !== 'object' || obj.kind !== WORKFLOW_FILE_KIND) {
    return { ok: false, message: "That file isn't a Bedrock workflow." };
  }
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    return { ok: false, message: 'The workflow file is missing its nodes or wires.' };
  }
  if (obj.nodes.length > MAX_NODES) return { ok: false, message: `A workflow can have at most ${MAX_NODES} nodes.` };
  const ids = new Set<string>();
  for (const node of obj.nodes as ExportNode[]) {
    const id = (node as { id?: unknown }).id;
    const type = node?.data?.nodeType;
    if (typeof id !== 'string' || !id || typeof type !== 'string') {
      return { ok: false, message: 'One of the nodes is incomplete.' };
    }
    if (ids.has(id)) return { ok: false, message: 'Two nodes share the same id.' };
    ids.add(id);
  }
  return {
    ok: true,
    file: {
      kind: WORKFLOW_FILE_KIND,
      version: typeof obj.version === 'number' ? obj.version : WORKFLOW_FILE_VERSION,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      title: typeof obj.title === 'string' && obj.title ? obj.title.slice(0, 100) : 'Imported workflow',
      nodes: obj.nodes,
      edges: obj.edges,
    },
  };
}
