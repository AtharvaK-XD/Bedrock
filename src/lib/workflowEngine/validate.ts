import type { EngineLimits, EngineTier, GraphIssue, WorkflowGraph, WorkflowNode } from './types';
import { ALL_NODE_TYPES } from './types';
import { isRunnable, liveEdges, planRun, upstreamOf } from './graph';
import { findTemplateNames, VARIABLE_NAME_RE } from './template';
import { parsePath } from './jsonPath';
import { resolveLimits } from './limits';

const label = (n: WorkflowNode) => `"${n.data?.title || n.id}"`;

/** How many AI calls a full run can make at most (For Each in AI mode counts once per allowed item). */
export function estimateAiCalls(graph: WorkflowGraph, tier: EngineTier = 'free', limits?: Partial<EngineLimits>): number {
  const cap = resolveLimits(tier, limits).maxForEachItems;
  let total = 0;
  for (const n of graph.nodes || []) {
    const d = n.data;
    if (!d) continue;
    if (d.nodeType === 'prompt' || d.nodeType === 'evaluation') total += 1;
    else if (d.nodeType === 'merge' && d.mergeStrategy === 'synthesize') total += 1;
    else if (d.nodeType === 'forEach' && d.forEachMode === 'ai') {
      const req = typeof d.forEachMaxItems === 'number' && d.forEachMaxItems > 0 ? d.forEachMaxItems : cap;
      total += Math.min(req, cap);
    }
  }
  return total;
}

/**
 * The "pipeline doctor": friendly problems and tips for a workflow. Nothing here blocks saving.
 * Severity: error = the run will fail at that step; warning = it will run but probably not as intended; tip = advice.
 * limits overrides the plan caps, e.g. the desktop app (own keys) passes { maxNodes: Infinity }.
 */
export function validateGraph(graph: WorkflowGraph, opts: { tier?: EngineTier; limits?: Partial<EngineLimits> } = {}): GraphIssue[] {
  const tier = opts.tier ?? 'free';
  const caps = resolveLimits(tier, opts.limits);
  const issues: GraphIssue[] = [];
  const nodes = graph.nodes || [];
  const runnable = nodes.filter(isRunnable);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = liveEdges(graph);

  if (runnable.length === 0) {
    issues.push({ severity: 'tip', code: 'EMPTY', message: 'The canvas is empty.', fix: 'Add a node from the palette on the right, or start from a template.' });
    return issues;
  }

  for (const e of graph.edges || []) {
    if (!byId.has(e.source) || !byId.has(e.target)) {
      issues.push({ severity: 'warning', code: 'DANGLING_EDGE', edgeId: e.id, message: 'A wire points to a node that no longer exists.', fix: 'Delete that wire.' });
    }
  }

  for (const n of nodes) {
    if (!n.data || !ALL_NODE_TYPES.includes(n.data.nodeType)) {
      issues.push({ severity: 'error', code: 'UNKNOWN_NODE', nodeId: n.id, message: `${n.data ? label(n) : n.id} is a kind of step this version does not know.`, fix: 'Delete it, or update the app.' });
    }
  }

  const plan = planRun(graph);
  for (const cycle of plan.cycles) {
    const names = cycle.map((id) => label(byId.get(id)!)).join(' → ');
    issues.push({ severity: 'error', code: 'CYCLE', nodeId: cycle[0], message: `These steps are wired in a loop: ${names}. A workflow needs a place to start.`, fix: 'Remove one wire in the loop.' });
  }

  const limit = caps.maxNodes;
  if (Number.isFinite(limit) && runnable.length > limit) {
    issues.push({
      severity: 'warning',
      code: 'PLAN_NODE_LIMIT',
      message: `This workflow has ${runnable.length} steps; your plan lets you add up to ${limit}.`,
      fix: 'It will still run. To add more steps, remove some or upgrade.',
    });
  }

  const aiCap = caps.maxAiCalls;
  const aiEstimate = estimateAiCalls(graph, tier, opts.limits);
  if (Number.isFinite(aiCap) && aiEstimate > aiCap) {
    issues.push({
      severity: 'warning',
      code: 'AI_CALLS_OVER_CAP',
      message: `A full run could need ${aiEstimate} AI calls, but one run can make at most ${aiCap} on your plan.`,
      fix: 'Use fewer AI steps or fewer list items.',
    });
  }

  const inEdges = (id: string) => edges.filter((e) => e.target === id);
  const outEdges = (id: string) => edges.filter((e) => e.source === id);

  // Variable names
  const varNodes = runnable.filter((n) => n.data.nodeType === 'variable');
  const varNames = new Map<string, number>();
  for (const v of varNodes) {
    const name = (v.data.variableName || '').trim();
    if (!VARIABLE_NAME_RE.test(name)) {
      issues.push({ severity: 'error', code: 'BAD_VARIABLE_NAME', nodeId: v.id, message: `${label(v)} needs a name made of letters, numbers or _.`, fix: 'For example: topic, user_name, score2.' });
    } else {
      varNames.set(name, (varNames.get(name) ?? 0) + 1);
    }
  }
  for (const [name, count] of varNames) {
    if (count > 1) {
      issues.push({ severity: 'warning', code: 'DUPLICATE_VARIABLE', message: `${count} Variable steps use the name "${name}"; the last one to run wins.`, fix: 'Give each Variable its own name.' });
    }
  }

  for (const n of runnable) {
    const d = n.data;
    const ins = inEdges(n.id);
    const outs = outEdges(n.id);

    if (runnable.length > 1 && ins.length === 0 && outs.length === 0) {
      issues.push({ severity: 'tip', code: 'LONELY_NODE', nodeId: n.id, message: `${label(n)} is not connected to anything.`, fix: 'Drag a wire from a dot on another step to this one.' });
    }

    switch (d.nodeType) {
      case 'prompt':
        if (!(d.description || '').trim()) {
          issues.push({ severity: 'warning', code: 'PROMPT_EMPTY', nodeId: n.id, message: `${label(n)} has no instructions, so only its title is sent to the AI.`, fix: 'Click it and write what you want the AI to do.' });
        }
        break;
      case 'output':
        if (ins.length === 0) {
          issues.push({ severity: 'warning', code: 'OUTPUT_NO_INPUT', nodeId: n.id, message: `${label(n)} has nothing connected, so it will show nothing.`, fix: 'Connect the step whose result you want to see.' });
        }
        break;
      case 'condition': {
        if (outs.length === 0) {
          issues.push({ severity: 'warning', code: 'CONDITION_NO_PATHS', nodeId: n.id, message: `${label(n)} decides TRUE or FALSE, but nothing comes after it.`, fix: 'Connect the green dot (TRUE) and the red dot (FALSE) to the next steps.' });
        } else {
          const hasTrue = outs.some((e) => e.sourceHandle === 'true');
          const hasFalse = outs.some((e) => e.sourceHandle === 'false');
          if (!hasTrue && !hasFalse) {
            issues.push({ severity: 'tip', code: 'CONDITION_NOT_BRANCHING', nodeId: n.id, message: `${label(n)} is not using its TRUE/FALSE dots, so everything after it always runs.`, fix: 'Use the green dot for "yes" and the red dot for "no".' });
          } else if (!hasTrue || !hasFalse) {
            issues.push({ severity: 'tip', code: 'CONDITION_ONE_PATH', nodeId: n.id, message: `${label(n)} has only a ${hasTrue ? 'TRUE' : 'FALSE'} path. When the answer is ${hasTrue ? 'FALSE' : 'TRUE'}, nothing happens.`, fix: `Connect the ${hasTrue ? 'red (FALSE)' : 'green (TRUE)'} dot too, if you want something to happen then.` });
          }
        }
        if (ins.length === 0 && !(d.description || '').trim()) {
          issues.push({ severity: 'warning', code: 'NO_INPUT', nodeId: n.id, message: `${label(n)} has nothing to check.`, fix: 'Connect the step whose answer you want to check.' });
        }
        for (const r of d.conditionGroup?.rules ?? []) {
          if (r.field && !parsePath(r.field)) {
            issues.push({ severity: 'error', code: 'BAD_PATH', nodeId: n.id, message: `${label(n)} has a rule with an invalid field path "${r.field}".`, fix: 'Use dots and [numbers], e.g. user.name or items[0].price.' });
          }
        }
        break;
      }
      case 'switch': {
        const cases = d.switchCases ?? [];
        if (cases.length === 0) {
          issues.push({ severity: 'error', code: 'NO_CASES', nodeId: n.id, message: `${label(n)} has no cases yet.`, fix: 'Add at least one case in the settings panel.' });
        }
        for (const c of cases) {
          if (!outs.some((e) => e.sourceHandle === `case:${c.id}`)) {
            issues.push({ severity: 'warning', code: 'SWITCH_CASE_UNWIRED', nodeId: n.id, message: `Case "${c.label || c.id}" of ${label(n)} is not connected to anything.`, fix: 'Drag a wire from that case’s dot to the next step.' });
          }
        }
        if (cases.length > 0 && !outs.some((e) => e.sourceHandle === 'default')) {
          issues.push({ severity: 'tip', code: 'SWITCH_NO_DEFAULT', nodeId: n.id, message: `${label(n)} has no "default" path for when no case matches.`, fix: 'Connect the default dot, if you want something to happen then.' });
        }
        if (d.switchField && !parsePath(d.switchField)) {
          issues.push({ severity: 'error', code: 'BAD_PATH', nodeId: n.id, message: `${label(n)} has an invalid field path "${d.switchField}".`, fix: 'Use dots and [numbers], e.g. user.name or items[0].price.' });
        }
        break;
      }
      case 'forEach':
        if (ins.length === 0 && !(d.description || '').trim()) {
          issues.push({ severity: 'warning', code: 'FOREACH_NO_INPUT', nodeId: n.id, message: `${label(n)} has no list to go through.`, fix: 'Connect a step that gives a list (one item per line, or a JSON array).' });
        }
        if ((d.forEachMode ?? 'template') === 'template' && !(d.forEachTemplate || '').trim()) {
          issues.push({ severity: 'tip', code: 'FOREACH_NO_TEMPLATE', nodeId: n.id, message: `${label(n)} has no template, so each item is passed on unchanged.`, fix: 'Write a template such as "Idea {{index}}: {{item}}".' });
        }
        break;
      case 'arrayTools':
      case 'jsonPick':
      case 'evaluation':
        if (ins.length === 0 && !(d.description || '').trim()) {
          issues.push({ severity: 'warning', code: 'NO_INPUT', nodeId: n.id, message: `${label(n)} has nothing to work on.`, fix: 'Connect a step to its left side.' });
        }
        if (d.nodeType === 'jsonPick') {
          if (!(d.jsonPath || '').trim()) issues.push({ severity: 'error', code: 'BAD_PATH', nodeId: n.id, message: `${label(n)} has no field path.`, fix: 'Type the field to read, e.g. items[0].title.' });
          else if (!parsePath(d.jsonPath || '')) issues.push({ severity: 'error', code: 'BAD_PATH', nodeId: n.id, message: `${label(n)} has an invalid field path.`, fix: 'Use dots and [numbers], e.g. user.name or items[0].title.' });
        }
        if (d.nodeType === 'arrayTools' && d.arrayOp === 'pluck' && !(d.arrayArg || '').trim()) {
          issues.push({ severity: 'error', code: 'BAD_PATH', nodeId: n.id, message: `${label(n)} needs the name of the field to pick.`, fix: 'Type a field name, e.g. title.' });
        }
        break;
      case 'merge':
        if (ins.length < 2) {
          issues.push({ severity: 'tip', code: 'MERGE_FEW_INPUTS', nodeId: n.id, message: `${label(n)} combines several paths, but has ${ins.length === 0 ? 'none' : 'only one'} connected.`, fix: 'Connect two or more steps to it.' });
        }
        break;
      case 'askInput':
        if (!(d.askQuestion || '').trim()) {
          issues.push({ severity: 'tip', code: 'ASK_NO_QUESTION', nodeId: n.id, message: `${label(n)} has no question, so its title is used.`, fix: 'Write the question to ask, e.g. "Which topic?"' });
        }
        break;
      default:
        break;
    }

    // Template variables in text the engine fills in
    const templated = d.nodeType === 'prompt' ? d.description || '' : d.nodeType === 'forEach' ? d.forEachTemplate || '' : '';
    if (templated) {
      const parents = upstreamOf(graph, n.id)
        .map((id) => byId.get(id)!)
        .filter((p) => p && p.data.nodeType !== 'system');
      const direct = ins.map((e) => byId.get(e.source)!).filter((p) => p && p.data.nodeType !== 'system');
      for (const name of findTemplateNames(templated)) {
        if (name.startsWith('vars.')) {
          const v = name.slice(5).trim();
          if (!varNames.has(v)) issues.push({ severity: 'tip', code: 'UNKNOWN_VARIABLE', nodeId: n.id, message: `${label(n)} uses {{${name}}}, but no Variable step is named "${v}".`, fix: `Add a Variable step named "${v}" before it, or fix the spelling.` });
          continue;
        }
        if (name.startsWith('node.')) {
          if (!byId.has(name.slice(5).trim())) issues.push({ severity: 'tip', code: 'UNKNOWN_VARIABLE', nodeId: n.id, message: `${label(n)} uses {{${name}}}, but there is no step with that id.`, fix: 'Check the step id in its settings.' });
          continue;
        }
        if (name === 'item' || name === 'index' || name.startsWith('item.') || name.startsWith('item[')) {
          if (d.nodeType !== 'forEach') issues.push({ severity: 'tip', code: 'ITEM_OUTSIDE_FOREACH', nodeId: n.id, message: `${label(n)} uses {{${name}}}, which only works inside a For Each step.`, fix: 'Move this text into a For Each step’s template.' });
          continue;
        }
        if (d.nodeType === 'prompt') {
          const lower = name.toLowerCase();
          const matches = direct.some((p) => {
            const slug = p.data.title.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            return p.id.toLowerCase() === lower || slug === lower || p.data.title.split(/[\s_-]+/).some((w) => w.length > 2 && w.toLowerCase() === lower);
          });
          if (!matches) {
            const viaUpstream = parents.some((p) => p.data.title.toLowerCase().includes(lower));
            issues.push({
              severity: 'tip',
              code: 'UNKNOWN_VARIABLE',
              nodeId: n.id,
              message: `${label(n)} uses {{${name}}}, but no step wired directly into it has that name.`,
              fix: viaUpstream ? 'Wire that step directly into this one.' : 'Use a word from the title of a step wired into this one.',
            });
          }
        }
      }
    }
  }

  const order = { error: 0, warning: 1, tip: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}
