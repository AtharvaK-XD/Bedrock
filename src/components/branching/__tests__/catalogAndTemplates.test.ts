import { describe, it, expect } from 'vitest';
import { ALL_NODE_TYPES, NODE_CATALOG, PALETTE_GROUPS, getCatalogEntry, getPaletteGroups, searchCatalog } from '../nodeCatalog';
import { BEGINNER_TEMPLATES, EXTRACT_LIST_CODE, STARTER_TEMPLATE_ID } from '../beginnerTemplates';

const TYPES_TODAY = ['system', 'prompt', 'output', 'data', 'condition', 'code', 'merge', 'evaluation', 'note', 'switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput'];

describe('node catalog', () => {
  it('describes all 15 node types', () => {
    expect(ALL_NODE_TYPES).toHaveLength(15);
    for (const t of ['system', 'prompt', 'output', 'data', 'condition', 'code', 'merge', 'evaluation', 'switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput', 'note']) {
      expect(NODE_CATALOG).toHaveProperty(t);
    }
  });

  it('gives every node a name, emoji, one sentence, in, out, example and a fix line', () => {
    for (const id of ALL_NODE_TYPES) {
      const e = NODE_CATALOG[id];
      expect(e.id).toBe(id);
      for (const field of [e.name, e.does, e.goesIn, e.comesOut, e.example, e.howToFix]) {
        expect(field.trim().length).toBeGreaterThan(2);
      }
      expect(e.emoji.trim().length).toBeGreaterThan(0);
      // "one sentence" stays short enough for a tooltip
      expect(e.does.length).toBeLessThanOrEqual(200);
    }
  });

  it('only suggests next nodes that exist, and never the sticky note', () => {
    for (const id of ALL_NODE_TYPES) {
      for (const next of NODE_CATALOG[id].nextNodes) {
        expect(NODE_CATALOG).toHaveProperty(next);
        expect(next).not.toBe('note');
      }
    }
  });

  it('offers exactly the nodes that exist in the editor today, grouped in the planned order', () => {
    const groups = getPaletteGroups();
    const offered = groups.flatMap((g) => g.entries.map((e) => e.id)).sort();
    expect(offered).toEqual([...TYPES_TODAY].sort());
    const order = PALETTE_GROUPS.map((g) => g.id);
    expect(groups.map((g) => g.group.id)).toEqual(order.filter((id) => groups.some((g) => g.group.id === id)));
    expect(PALETTE_GROUPS.map((g) => g.label)).toEqual(['Start', 'Think (AI)', 'Decide', 'Lists and data', 'Finish']);
  });

  it('finds nodes by the words people type', () => {
    expect(searchCatalog('if').map((e) => e.id)).toContain('condition');
    expect(searchCatalog('list').map((e) => e.id)).toContain('code');
    // typing "note" must put Sticky Note first, even though Data's keywords mention "notes"
    expect(searchCatalog('note')[0].id).toBe('note');
    expect(searchCatalog('persona')[0].id).toBe('system');
    expect(searchCatalog('output')[0].id).toBe('output');
    expect(searchCatalog('judge').map((e) => e.id)).toEqual(['evaluation']);
    expect(searchCatalog('zzzz')).toEqual([]);
    // an empty search shows everything that can be added
    expect(searchCatalog('')).toHaveLength(TYPES_TODAY.length);
  });

  it('offers every Branching v2 node type in the palette now that their settings exist', () => {
    expect(searchCatalog('switch').map((e) => e.id)).toContain('switch');
    expect(searchCatalog('loop').map((e) => e.id)).toContain('forEach');
    expect(searchCatalog('ask').map((e) => e.id)).toContain('askInput');
    expect(getCatalogEntry('forEach')?.available).toBe(true);
    expect(getCatalogEntry('nope')).toBeNull();
  });
});

describe('beginner templates', () => {
  it('has the four starters from the plan, with the starter first', () => {
    expect(BEGINNER_TEMPLATES.map((t) => t.title)).toEqual(["Explain like I'm 5", 'Is it positive?', 'Summarise my notes', 'Make a to-do list']);
    expect(BEGINNER_TEMPLATES[0].id).toBe(STARTER_TEMPLATE_ID);
  });

  it('fits the free plan: at most 3 nodes each, free model, known node types', () => {
    for (const tpl of BEGINNER_TEMPLATES) {
      expect(tpl.nodes.length).toBeLessThanOrEqual(3);
      expect(tpl.archetypes).toHaveLength(tpl.nodes.length);
      for (const node of tpl.nodes) {
        expect(node.data.modelId).toBe('gemini-3.5-flash-lite');
        expect(NODE_CATALOG).toHaveProperty(node.data.nodeType);
        expect(node.data.status).toBe('idle');
      }
    }
  });

  it('uses the node types the plan names', () => {
    const types = (title: string) => BEGINNER_TEMPLATES.find((t) => t.title === title)!.nodes.map((n) => n.data.nodeType);
    expect(types("Explain like I'm 5")).toEqual(['system', 'prompt', 'output']);
    expect(types('Is it positive?')).toEqual(['prompt', 'condition', 'output']);
    expect(types('Summarise my notes')).toEqual(['data', 'prompt', 'output']);
    expect(types('Make a to-do list')).toEqual(['prompt', 'code', 'output']);
  });

  it('wires every edge between nodes that exist, with unique ids', () => {
    for (const tpl of BEGINNER_TEMPLATES) {
      const ids = new Set(tpl.nodes.map((n) => n.id));
      expect(ids.size).toBe(tpl.nodes.length);
      const edgeIds = new Set(tpl.edges.map((e) => e.id));
      expect(edgeIds.size).toBe(tpl.edges.length);
      for (const e of tpl.edges) {
        expect(ids.has(e.source)).toBe(true);
        expect(ids.has(e.target)).toBe(true);
      }
    }
  });

  it('the "Is it positive?" condition checks for the word "positive" and sends both paths to the result', () => {
    const tpl = BEGINNER_TEMPLATES.find((t) => t.title === 'Is it positive?')!;
    const condition = tpl.nodes.find((n) => n.data.nodeType === 'condition')!;
    expect(condition.data.conditionRule).toBe('contains');
    expect(condition.data.conditionValue).toBe('positive');
    const fromCondition = tpl.edges.filter((e) => e.source === condition.id);
    expect(fromCondition.map((e) => e.sourceHandle).sort()).toEqual(['false', 'true']);
  });

  it('the checklist script turns lines into checklist items', () => {
    const run = new Function('input', EXTRACT_LIST_CODE) as (input: string) => string;
    expect(run('1. Buy a cake\n- Invite friends\n\n* Blow up balloons\n')).toBe('[ ] Buy a cake\n[ ] Invite friends\n[ ] Blow up balloons');
    expect(run('')).toBe('');
  });
});
