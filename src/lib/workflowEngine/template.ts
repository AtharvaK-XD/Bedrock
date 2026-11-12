import { getPath, stringifyValue } from './jsonPath';

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface TemplateParent {
  id: string;
  title: string;
  /** output || description || '' (what the original Run button used) */
  value: string;
}

/**
 * The original prompt-node variable replacement, as a pure function. For every connected (non-persona) node,
 * `{{<node id>}}`, `{{<title_as_slug>}}` and `{{<any title word longer than 2 letters>}}` are replaced by its output.
 * Difference from the page code: names are escaped before building the pattern, so a title like "C++ Helper" no
 * longer throws. Normal names behave exactly the same.
 */
export function applyLegacyTemplate(text: string, parents: TemplateParent[]): string {
  let resolved = text;
  for (const p of parents) {
    const val = p.value;
    // A function replacer, so "$&" or "$1" inside an AI answer is inserted literally
    resolved = resolved.replace(new RegExp(`{{\\s*${escapeRegExp(p.id)}\\s*}}`, 'gi'), () => val);
    const slug = p.title.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    resolved = resolved.replace(new RegExp(`{{\\s*${escapeRegExp(slug)}\\s*}}`, 'gi'), () => val);
    p.title.split(/[\s_-]+/).forEach((word) => {
      if (word.length > 2) {
        resolved = resolved.replace(new RegExp(`{{\\s*${escapeRegExp(word)}\\s*}}`, 'gi'), () => val);
      }
    });
  }
  return resolved;
}

export interface ExtendedTemplateContext {
  vars: Record<string, string>;
  nodeText: (id: string) => string | undefined;
  item?: unknown;
  /** 1-based position of the item (For Each) */
  index?: number;
}

const EXTENDED_VAR = /{{\s*((?:vars|node|item)(?:[.[][^{}]*)?|index)\s*}}/g;

/**
 * Branching v2 variables: {{vars.name}}, {{node.<id>}}, {{item}}, {{item.field}}, {{index}} (starts at 1).
 * Anything unknown is left exactly as written, so the person can see what did not match.
 */
export function applyExtendedTemplate(text: string, ctx: ExtendedTemplateContext): string {
  return text.replace(EXTENDED_VAR, (whole, name: string) => {
    if (name === 'index') return ctx.index !== undefined ? String(ctx.index) : whole;
    if (name.startsWith('vars.')) {
      const key = name.slice(5).trim();
      return Object.prototype.hasOwnProperty.call(ctx.vars, key) ? ctx.vars[key] : whole;
    }
    if (name.startsWith('node.')) {
      const got = ctx.nodeText(name.slice(5).trim());
      return got !== undefined ? got : whole;
    }
    if (name === 'item') return ctx.item !== undefined ? stringifyValue(ctx.item) : whole;
    if (name.startsWith('item.') || name.startsWith('item[')) {
      if (ctx.item === undefined) return whole;
      const got = getPath(ctx.item, name.slice(4));
      return got.found ? stringifyValue(got.value) : whole;
    }
    return whole;
  });
}

/** Every {{...}} name in a text, e.g. ['vars.topic', 'research', 'item.title']. */
export function findTemplateNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/{{\s*([^{}]+?)\s*}}/g)) names.add(m[1]);
  return [...names];
}

export const VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
