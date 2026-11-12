/**
 * Helpers for the Result inspector: decide what a node's output is (text, JSON, a list), turn a list of
 * objects into table rows, and prepare files for download. Pure, so it can be tested without a browser.
 */

export type OutputKind = 'empty' | 'text' | 'json' | 'array' | 'number' | 'boolean';

export interface ParsedOutput {
  kind: OutputKind;
  /** The parsed value for json / array / number / boolean. */
  value?: unknown;
}

/** Same rules as the NodeResult envelope in the Branching plan, so the inspector agrees with the engine later. */
export function parseOutput(text: string | undefined | null): ParsedOutput {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { kind: 'empty' };
  if (trimmed === 'true' || trimmed === 'false') return { kind: 'boolean', value: trimmed === 'true' };
  if (/^-?\d+(\.\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed))) return { kind: 'number', value: Number(trimmed) };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const value = JSON.parse(trimmed);
      if (Array.isArray(value)) return { kind: 'array', value };
      if (value && typeof value === 'object') return { kind: 'json', value };
    } catch {
      // not JSON: falls through to plain text
    }
  }
  return { kind: 'text' };
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export interface TableData {
  columns: string[];
  rows: string[][];
}

const MAX_COLUMNS = 12;
const MAX_ROWS = 500;

/** A table is offered only when the output is a list of plain objects (a list of numbers or text has no columns). */
export function toTable(value: unknown): TableData | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  if (!value.every(isRecord)) return null;

  const columns: string[] = [];
  for (const row of value) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
      if (columns.length >= MAX_COLUMNS) break;
    }
    if (columns.length >= MAX_COLUMNS) break;
  }
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };
  const rows = (value as Record<string, unknown>[]).slice(0, MAX_ROWS).map((row) => columns.map((c) => cell(row[c])));
  return { columns, rows };
}

/** A short label for a node's output type, shown as a badge ("Text", "JSON", "List (7)"). */
export function describeKind(parsed: ParsedOutput): string {
  switch (parsed.kind) {
    case 'array':
      return `List (${(parsed.value as unknown[]).length})`;
    case 'json':
      return 'JSON';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Yes/No';
    case 'empty':
      return 'Empty';
    default:
      return 'Text';
  }
}

export interface DownloadFile {
  filename: string;
  mime: string;
  content: string;
}

export function buildDownload(text: string, as: 'txt' | 'json', baseName = 'bedrock-output'): DownloadFile {
  const safeBase = baseName.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'bedrock-output';
  if (as === 'json') {
    const parsed = parseOutput(text);
    const content = parsed.kind === 'json' || parsed.kind === 'array' ? prettyJson(parsed.value) : JSON.stringify({ text }, null, 2);
    return { filename: `${safeBase}.json`, mime: 'application/json', content };
  }
  return { filename: `${safeBase}.txt`, mime: 'text/plain', content: text };
}
