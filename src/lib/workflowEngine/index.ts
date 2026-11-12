/**
 * Branching v2 workflow engine. Pure TypeScript (no React, no fetch): the page passes in how to call the AI,
 * run code, test a regex and ask the person a question. Contract: agent-sync/BRANCHING_PROMPTS.md section 0.
 *
 * Quick use (Frontend):
 *   const summary = await runWorkflow({ nodes, edges }, {
 *     tier: 'free',
 *     deps: { callAI: (m, s, p, onToken) => testPrompt(m, s, p, onToken), runCode: runSandboxedCode,
 *             regexTest: safeRegexTest, askInput: openAskDialog },
 *     signal: controller.signal,
 *     onEvent: (e) => { ... update node status/output from e.result ... },
 *   });
 *   const issues = validateGraph({ nodes, edges }, { tier: 'free' });
 */
export * from './types';
export { planRun, downstreamOf, upstreamOf, liveEdges, isRunnable } from './graph';
export { runWorkflow, buildEvaluationPrompt, parseEvaluation, EVALUATOR_SYSTEM, SYNTHESIZER_SYSTEM } from './runner';
export { validateGraph, estimateAiCalls } from './validate';
export { evaluateLegacy, evaluateRule, evaluateGroup, type ConditionOutcome, type ConditionContext } from './conditions';
export { toList, splitLines, applyArrayOp, filterMatches } from './arrays';
export { getPath, parsePath, parseJsonSafe, stringifyValue } from './jsonPath';
export { applyLegacyTemplate, applyExtendedTemplate, findTemplateNames, VARIABLE_NAME_RE } from './template';
export { detectKind, makeResult, makeError, ERROR_TEXT, EngineError } from './result';
export { ENGINE_LIMITS, resolveLimits, DEFAULT_MODEL_ID, LEGACY_SKIP_TEXT, UPSTREAM_FAILED_SKIP_TEXT } from './limits';
