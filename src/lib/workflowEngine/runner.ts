import type {
  EngineEvent, NodeResult, RunOptions, RunSummary, WorkflowEdge, WorkflowGraph, WorkflowNode,
} from './types';
import { downstreamOf, liveEdges, planRun, upstreamOf } from './graph';
import { applyLegacyTemplate, applyExtendedTemplate, VARIABLE_NAME_RE } from './template';
import { evaluateGroup, evaluateLegacy, evaluateRule, type ConditionContext } from './conditions';
import { applyArrayOp, toList } from './arrays';
import { getPath, parseJsonSafe, stringifyValue } from './jsonPath';
import { EngineError, makeError, makeResult, startTiming, toEngineError, type ResultTiming } from './result';
import { DEFAULT_MODEL_ID, LEGACY_SKIP_TEXT, UPSTREAM_FAILED_SKIP_TEXT, resolveLimits } from './limits';

/** Same evaluator prompt as the Quality Judge's Run button. */
const EVAL_CRITERIA_LABELS: Record<string, string> = {
  accuracy: 'Accuracy & Reliability',
  clarity: 'Clarity & Concise Tone',
  code_quality: 'Code Quality & Safety',
  guardrails: 'Policy & Guardrails',
};

export function buildEvaluationPrompt(criteria: string | undefined, content: string): string {
  const criteriaLabel = (criteria && EVAL_CRITERIA_LABELS[criteria]) || 'Factual Accuracy & Reliability';
  return `You are an expert AI Judge. Grade the following output strictly based on: "${criteriaLabel}".
Provide your evaluation in this EXACT format:
SCORE: [number between 0 and 100]
FEEDBACK: [1 to 2 sentences explaining the grade]

Content to evaluate:
${content}`;
}

export const EVALUATOR_SYSTEM = 'You are an objective AI evaluator.';
export const SYNTHESIZER_SYSTEM = 'You are an expert synthesizer. Merge all context into a single coherent output.';
/** Same text as JSON_ANSWER_INSTRUCTION in api/_lib/workflowAi.ts */
export const JSON_ONLY_INSTRUCTION = 'Answer with valid JSON only: no explanations before or after it, and no code fences.';

/** Reads "SCORE: 87" and "FEEDBACK: ..." from the judge's answer. No made-up score when none is found. */
export function parseEvaluation(raw: string): { score?: number; critique: string } {
  const scoreMatch = raw.match(/SCORE:\s*(\d+)/i);
  const feedbackMatch = raw.match(/FEEDBACK:\s*([\s\S]+)/i);
  const critique = feedbackMatch ? feedbackMatch[1].trim() : raw;
  if (!scoreMatch) return { critique };
  return { score: Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))), critique };
}

interface NodeContext {
  node: WorkflowNode;
  parents: WorkflowNode[];
  sysNodes: WorkflowNode[];
  nonSysNodes: WorkflowNode[];
  sysPrompt: string;
  upstreamText: string;
  timing: ResultTiming;
}

/**
 * Runs a whole workflow, or one node (`only`), or a node and everything after it (`startFrom`).
 * Nodes run one at a time in a safe order. Paths turned off by an if/else or switch are skipped, an error stops
 * only the nodes below it, and the person can stop the run at any time.
 */
export async function runWorkflow(graph: WorkflowGraph, opts: RunOptions): Promise<RunSummary> {
  const runStart = Date.now();
  const limits = resolveLimits(opts.tier, opts.limits);
  const emit = (e: EngineEvent) => {
    try {
      opts.onEvent?.(e);
    } catch {
      // A UI listener error must never break the run
    }
  };
  const nodes = graph.nodes || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = liveEdges(graph);
  const incoming = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e);
  }
  const plan = planRun(graph);
  const results: Record<string, NodeResult> = {};
  const vars: Record<string, string> = {};
  let aiCalls = 0;
  let cancelled = false;

  // Variables already stored on Variable nodes can be used by a single-node run
  for (const n of nodes) {
    if (n.data?.nodeType === 'variable' && n.data.variableName && typeof n.data.output === 'string' && VARIABLE_NAME_RE.test(n.data.variableName)) {
      vars[n.data.variableName] = n.data.output;
    }
  }

  const finish = (status: RunSummary['status'], order: string[]): RunSummary => {
    const summary: RunSummary = { status, order, results, aiCalls, durationMs: Date.now() - runStart, vars: { ...vars } };
    emit({ type: 'run-done', summary });
    return summary;
  };

  if (plan.cycles.length > 0) {
    const inCycle = new Set(plan.cycles.flat());
    emit({ type: 'run-start', order: [] });
    for (const id of inCycle) {
      const node = byId.get(id)!;
      const result = makeError(node, 'CYCLE', startTiming());
      results[id] = result;
      emit({ type: 'node-error', nodeId: id, result });
    }
    return finish('error', []);
  }

  let toRun: Set<string>;
  if (opts.only) toRun = new Set(byId.has(opts.only) ? [opts.only] : []);
  else if (opts.startFrom) toRun = byId.has(opts.startFrom) ? downstreamOf(graph, opts.startFrom) : new Set();
  else toRun = new Set(plan.order);
  const order = plan.order.filter((id) => toRun.has(id));
  emit({ type: 'run-start', order });

  /** Output of a node: from this run, or the one stored on the node from an earlier run. */
  const outputOf = (n: WorkflowNode): string | undefined => (results[n.id] ? results[n.id].text : n.data.output);
  const parentText = (n: WorkflowNode) => outputOf(n) || n.data.description || n.data.title;

  const isEdgeActive = (e: WorkflowEdge): boolean => {
    const src = byId.get(e.source)!;
    const r = results[e.source];
    const handle = e.sourceHandle ?? undefined;
    if (r) {
      if (r.skipped || r.error) return false;
      if (src.data.nodeType === 'condition') {
        if (handle === 'true') return r.branch === 'true';
        if (handle === 'false') return r.branch === 'false';
        return true;
      }
      if (src.data.nodeType === 'switch') {
        if (handle && handle.startsWith('case:')) return r.branch === handle;
        if (handle === 'default') return r.branch === 'default';
        return true;
      }
      return true;
    }
    // Not run in this run: use what is stored on the node (same rule as the original Run button)
    const stored = src.data.result as NodeResult | undefined;
    if (stored?.skipped || stored?.error) return false;
    if (src.data.nodeType === 'condition') {
      const cr = src.data.conditionResult;
      if (cr === undefined) return true;
      if (handle === 'true' && !cr) return false;
      if (handle === 'false' && cr) return false;
      return true;
    }
    if (src.data.nodeType === 'switch') {
      const branch = stored?.branch;
      if (!branch) return true;
      if (handle && handle.startsWith('case:')) return branch === handle;
      if (handle === 'default') return branch === 'default';
      return true;
    }
    return true;
  };

  const callAI = async (ctx: NodeContext, system: string, prompt: string, onToken?: (t: string) => void, aiOpts?: { responseFormat?: 'json' }) => {
    if (aiCalls >= limits.maxAiCalls) throw new EngineError('AI_LIMIT_REACHED', `limit ${limits.maxAiCalls}`);
    if (opts.signal?.aborted) throw new EngineError('CANCELLED');
    aiCalls++;
    ctx.timing.aiCalls++;
    const model = ctx.node.data.modelId || DEFAULT_MODEL_ID;
    ctx.timing.model = model;
    return opts.deps.callAI(model, system, prompt, onToken, aiOpts);
  };

  const conditionCtx = (nodeId: string): ConditionContext => ({
    regexTest: (p, t) => opts.deps.regexTest(p, t),
    upstreamScore: () => {
      for (const id of upstreamOf(graph, nodeId)) {
        const n = byId.get(id);
        if (n?.data.nodeType !== 'evaluation') continue;
        const s = results[id]?.score ?? (typeof n.data.evalScore === 'number' ? n.data.evalScore : undefined);
        if (s !== undefined) return s;
      }
      return undefined;
    },
  });

  const execute = async (ctx: NodeContext): Promise<NodeResult> => {
    const { node, sysPrompt, upstreamText, nonSysNodes, timing } = ctx;
    const d = node.data;
    switch (d.nodeType) {
      case 'system':
        return makeResult(node, d.description || 'System persona active.', timing);

      case 'data': {
        const payload = d.dataPayload || d.description;
        try {
          return makeResult(node, JSON.stringify(JSON.parse(payload), null, 2), timing);
        } catch {
          return makeResult(node, payload, timing);
        }
      }

      case 'code': {
        const script = d.codeScript || 'return input;';
        try {
          return makeResult(node, await opts.deps.runCode(script, upstreamText || d.description), timing);
        } catch (err) {
          throw toEngineError(err, 'CODE_FAILED');
        }
      }

      case 'condition': {
        const input = upstreamText || d.description;
        const group = d.conditionGroup;
        const outcome = group && Array.isArray(group.rules) && group.rules.length > 0
          ? evaluateGroup(group, input, conditionCtx(node.id))
          : evaluateLegacy(d.conditionRule, d.conditionValue, input, conditionCtx(node.id));
        const text = upstreamText || d.description || (outcome.passed ? 'Condition Passed' : 'Condition Failed');
        return makeResult(node, text, timing, {
          branch: outcome.passed ? 'true' : 'false',
          reason: `${outcome.passed ? 'TRUE' : 'FALSE'}: ${outcome.reason}`,
          ...(outcome.problem ? { notes: [outcome.problem === 'REGEX_UNSAFE' ? 'The pattern could freeze the page, so it was not used.' : outcome.problem === 'REGEX_INVALID' ? 'The pattern is not valid.' : 'The field path is not valid.'] } : {}),
        });
      }

      case 'switch': {
        const cases = Array.isArray(d.switchCases) ? d.switchCases : [];
        if (cases.length === 0) throw new EngineError('NO_CASES');
        const input = upstreamText || d.description;
        const cctx = conditionCtx(node.id);
        const misses: string[] = [];
        for (const c of cases) {
          const outcome = evaluateRule({ field: d.switchField, op: c.op, value: c.value }, input, cctx);
          if (outcome.passed) {
            return makeResult(node, input, timing, { branch: `case:${c.id}`, reason: `Case "${c.label || c.id}": ${outcome.reason}` });
          }
          misses.push(`"${c.label || c.id}" did not match`);
        }
        return makeResult(node, input, timing, { branch: 'default', reason: `Default: no case matched (${misses.join(', ')})` });
      }

      case 'merge': {
        const strategy = d.mergeStrategy || 'concat';
        const content = (p: WorkflowNode) => outputOf(p) || p.data.description;
        if (strategy === 'concat') {
          return makeResult(node, nonSysNodes.map((p) => `--- Source: ${p.data.title} ---\n${content(p)}`).join('\n\n'), timing);
        }
        if (strategy === 'bullets') {
          return makeResult(node, nonSysNodes.map((p) => `• [${p.data.title}]: ${content(p)}`).join('\n'), timing);
        }
        if (strategy === 'json') {
          return makeResult(node, JSON.stringify(nonSysNodes.map((p) => ({ source: p.data.title, content: content(p) })), null, 2), timing);
        }
        const synthesisPrompt = `Synthesize and unify these ${nonSysNodes.length} workflow branches into a coherent output:\n\n${upstreamText}`;
        try {
          return makeResult(node, await callAI(ctx, SYNTHESIZER_SYSTEM, synthesisPrompt), timing);
        } catch (err) {
          throw toEngineError(err, 'AI_FAILED');
        }
      }

      case 'evaluation': {
        let raw: string;
        try {
          raw = await callAI(ctx, EVALUATOR_SYSTEM, buildEvaluationPrompt(d.evalCriteria, upstreamText || d.description));
        } catch (err) {
          throw toEngineError(err, 'AI_FAILED');
        }
        const { score, critique } = parseEvaluation(raw);
        if (score === undefined) {
          return makeResult(node, `Score: not given\nFeedback: ${critique}`, timing, {
            notes: ['The judge did not give a score this time. Run it again to get one.'],
          });
        }
        return makeResult(node, `Score: ${score}/100\nFeedback: ${critique}`, timing, { score });
      }

      case 'output':
        return makeResult(node, upstreamText || d.description || 'Terminal ready. Run upstream nodes to feed output.', timing);

      case 'forEach': {
        const source = upstreamText || d.description;
        const list = toList(source);
        if (!list || list.length === 0) throw new EngineError(list ? 'NO_INPUT' : 'NOT_A_LIST');
        const requested = typeof d.forEachMaxItems === 'number' && d.forEachMaxItems > 0 ? Math.floor(d.forEachMaxItems) : limits.maxForEachItems;
        const cap = Math.min(requested, limits.maxForEachItems);
        const items = list.slice(0, cap);
        const notes: string[] = [];
        if (list.length > items.length) {
          const planCapped = requested >= limits.maxForEachItems;
          notes.push(`Only the first ${items.length} of ${list.length} items were used${planCapped ? " (your plan's limit for one step)" : ''}.`);
        }
        const mode = d.forEachMode || 'template';
        const template = d.forEachTemplate && d.forEachTemplate.trim() ? d.forEachTemplate : '{{item}}';
        const out: string[] = [];
        for (let i = 0; i < items.length; i++) {
          if (opts.signal?.aborted) throw new EngineError('CANCELLED');
          const rendered = applyExtendedTemplate(template, { vars, nodeText: (id) => (byId.has(id) ? parentText(byId.get(id)!) : undefined), item: items[i], index: i + 1 });
          if (mode === 'ai') {
            try {
              out.push(await callAI(ctx, sysPrompt, rendered));
            } catch (err) {
              throw toEngineError(err, 'AI_FAILED');
            }
          } else {
            out.push(rendered);
          }
        }
        return makeResult(node, JSON.stringify(out, null, 2), timing, { meta: { itemCount: items.length }, ...(notes.length ? { notes } : {}) });
      }

      case 'arrayTools': {
        const source = upstreamText || d.description;
        const res = applyArrayOp(d.arrayOp || 'split_lines', source, d.arrayArg ?? '');
        if (!res.ok) throw new EngineError(res.code);
        const v = res.value;
        const text = Array.isArray(v) ? JSON.stringify(v, null, 2) : stringifyValue(v);
        return makeResult(node, text, timing, {
          ...(Array.isArray(v) ? { meta: { itemCount: v.length } } : {}),
          ...(res.note ? { notes: [res.note] } : {}),
        });
      }

      case 'jsonPick': {
        const source = upstreamText || d.description;
        const path = (d.jsonPath || '').trim();
        if (!path) throw new EngineError('BAD_PATH', 'no path set');
        const parsed = parseJsonSafe(source);
        const fallback = typeof d.jsonFallback === 'string' && d.jsonFallback !== '' ? d.jsonFallback : undefined;
        if (!parsed.ok) {
          if (fallback !== undefined) return makeResult(node, fallback, timing, { notes: ['The input was not JSON, so the fallback value was used.'] });
          throw new EngineError('NOT_JSON');
        }
        const got = getPath(parsed.value, path);
        if (!got.found) {
          if (got.reason === 'bad_path') throw new EngineError('BAD_PATH');
          if (fallback !== undefined) return makeResult(node, fallback, timing, { notes: [`"${path}" was not found, so the fallback value was used.`] });
          throw new EngineError('PATH_NOT_FOUND', path);
        }
        return makeResult(node, stringifyValue(got.value), timing);
      }

      case 'variable': {
        const name = (d.variableName || '').trim();
        if (!VARIABLE_NAME_RE.test(name)) throw new EngineError('BAD_VARIABLE_NAME');
        const value = upstreamText || d.description || '';
        vars[name] = value;
        return makeResult(node, value, timing, { reason: `Saved as {{vars.${name}}}` });
      }

      case 'askInput': {
        const question = d.askQuestion || d.description || d.title || 'Your answer';
        const answer = await opts.deps.askInput({ id: node.id, question, ...(d.askDefault ? { default: d.askDefault } : {}) });
        if (answer === null) throw new EngineError('CANCELLED');
        return makeResult(node, answer, timing);
      }

      case 'prompt':
      default: {
        // A missing type runs as a prompt (as on the page); a type this version does not know is refused, not guessed
        if (d.nodeType !== 'prompt' && d.nodeType !== undefined) {
          throw new EngineError('UNKNOWN_NODE', String(d.nodeType));
        }
        let resolvedPrompt = d.description || d.title;
        resolvedPrompt = applyLegacyTemplate(
          resolvedPrompt,
          nonSysNodes.map((p) => ({ id: p.id, title: p.data.title, value: outputOf(p) || p.data.description || '' }))
        );
        resolvedPrompt = applyExtendedTemplate(resolvedPrompt, { vars, nodeText: (id) => (byId.has(id) ? parentText(byId.get(id)!) : undefined) });
        let finalUserPrompt = resolvedPrompt;
        if (upstreamText && !(d.description || '').includes('{{')) {
          finalUserPrompt = `[Upstream Input Context]\n${upstreamText}\n\n[Instruction]\n${resolvedPrompt}`;
        }
        // JSON mode: said in the system prompt too, so it works even where the AI call ignores the option
        const wantsJson = d.responseFormat === 'json';
        const system = wantsJson ? (sysPrompt ? `${sysPrompt}\n\n${JSON_ONLY_INSTRUCTION}` : JSON_ONLY_INSTRUCTION) : sysPrompt;
        let text: string;
        try {
          text = await callAI(
            ctx,
            system,
            finalUserPrompt,
            (token) => emit({ type: 'node-token', nodeId: node.id, token }),
            d.responseFormat === 'json' ? { responseFormat: 'json' } : undefined
          );
        } catch (err) {
          throw toEngineError(err, 'AI_FAILED');
        }
        const result = makeResult(node, text, timing);
        if (d.responseFormat === 'json' && result.kind !== 'json' && result.kind !== 'array') {
          result.notes = [...(result.notes ?? []), 'You asked for JSON, but the answer is not valid JSON.'];
        }
        return result;
      }
    }
  };

  const ran: string[] = [];
  for (const id of order) {
    const node = byId.get(id)!;
    if (opts.signal?.aborted || cancelled) {
      cancelled = true;
      break;
    }
    const timing = startTiming();
    const inc = incoming.get(id) ?? [];
    const active = inc.filter(isEdgeActive);
    if (inc.length > 0 && active.length === 0) {
      const upstreamFailed = inc.some((e) => {
        const r = results[e.source];
        return Boolean(r?.error || (r?.skipped && r.text === UPSTREAM_FAILED_SKIP_TEXT));
      });
      const result: NodeResult = {
        ...makeResult(node, upstreamFailed ? UPSTREAM_FAILED_SKIP_TEXT : LEGACY_SKIP_TEXT, timing),
        kind: 'empty',
        skipped: true,
      };
      delete result.value;
      results[id] = result;
      ran.push(id);
      emit({ type: 'node-skipped', nodeId: id, result });
      continue;
    }
    const parents = active.map((e) => byId.get(e.source)!).filter(Boolean);
    const uniqueParents = [...new Map(parents.map((p) => [p.id, p])).values()];
    const sysNodes = uniqueParents.filter((p) => p.data.nodeType === 'system');
    const nonSysNodes = uniqueParents.filter((p) => p.data.nodeType !== 'system');
    const ctx: NodeContext = {
      node,
      parents: uniqueParents,
      sysNodes,
      nonSysNodes,
      sysPrompt: sysNodes.map((p) => outputOf(p) || p.data.description).filter(Boolean).join('\n\n'),
      upstreamText: nonSysNodes.map(parentText).filter(Boolean).join('\n\n'),
      timing,
    };
    emit({ type: 'node-start', nodeId: id });
    try {
      const result = await execute(ctx);
      results[id] = result;
      ran.push(id);
      emit({ type: 'node-done', nodeId: id, result });
    } catch (err) {
      const e = toEngineError(err, 'AI_FAILED');
      const result = makeError(node, e.code, timing, e.code === 'AI_FAILED' || e.code === 'CODE_FAILED' || e.code === 'PATH_NOT_FOUND' || e.code === 'UNKNOWN_NODE' ? e.detail : undefined);
      results[id] = result;
      ran.push(id);
      emit({ type: 'node-error', nodeId: id, result });
      if (e.code === 'CANCELLED') {
        cancelled = true;
        break;
      }
    }
  }

  if (cancelled) return finish('cancelled', ran);
  const executed = ran.map((id) => results[id]).filter((r) => !r.skipped);
  const errors = executed.filter((r) => r.error).length;
  const status: RunSummary['status'] = errors === 0 ? 'success' : errors === executed.length ? 'error' : 'partial';
  return finish(status, ran);
}
