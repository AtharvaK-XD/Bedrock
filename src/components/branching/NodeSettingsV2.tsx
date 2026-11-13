import { useMemo, useState } from 'react';
import { Braces, Check, Copy, FlaskConical, ListFilter, MessageCircleQuestion, Plus, Repeat, Signpost, Trash2, Variable } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  ENGINE_LIMITS,
  VARIABLE_NAME_RE,
  evaluateGroup,
  evaluateLegacy,
  evaluateRule,
  type ConditionGroup,
  type ConditionOp,
  type ConditionRuleV2,
  type EngineTier,
  type SwitchCase,
  type WorkflowNodeData,
} from '../../lib/workflowEngine';
import { safeRegexTest } from '../../lib/workflowEngine/safeRegex';
import { ARRAY_OP_INFO, CASE_COLORS, CONDITION_OP_INFO, MAX_SWITCH_CASES, listJsonPaths, newCaseId, opInfo } from './nodeTypesV2';

type Patch = Partial<WorkflowNodeData>;

const label = 'text-xs font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5';
const field = 'w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono placeholder:text-gray-600';
const help = 'text-[11px] text-gray-400 leading-snug';
const chip = 'px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors';

const OP_GROUPS = ['Text', 'Numbers', 'Lists', 'Shape', 'Quality Judge'] as const;

function OpSelect({ value, onChange, accent }: { value: ConditionOp; onChange: (op: ConditionOp) => void; accent: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ConditionOp)} className={cn(field, accent)} aria-label="Rule">
      {OP_GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {CONDITION_OP_INFO.filter((o) => o.group === g).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const testCtx = { regexTest: safeRegexTest, upstreamScore: () => undefined };

/** "Try it": type a sample answer and see which way the decision goes, without running anything. */
function TryIt({ sample, render }: { sample?: string; render: (text: string) => { ok: boolean; text: string } }) {
  const [text, setText] = useState(sample ?? '');
  const outcome = text.trim() ? render(text) : null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
        <FlaskConical className="w-3 h-3" /> Try it (nothing runs)
      </span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Type a sample answer, e.g. I am so happy today"
        className={cn(field, 'resize-y custom-scrollbar')}
      />
      {outcome && (
        <p className={cn('text-[11px] font-mono leading-snug', outcome.ok ? 'text-emerald-300' : 'text-rose-300')} aria-live="polite">
          {outcome.text}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// If/Else: optional smart rules (several rules, numbers, lists, JSON fields, judge score)

export function ConditionRulesV2({ data, onChange, sample }: { data: Patch; onChange: (p: Patch) => void; sample?: string }) {
  const group: ConditionGroup = data.conditionGroup && Array.isArray(data.conditionGroup.rules) ? data.conditionGroup : { mode: 'all', rules: [] };
  const rules = group.rules;
  const setGroup = (g: ConditionGroup) => onChange({ conditionGroup: g });
  const setRule = (i: number, patch: Partial<ConditionRuleV2>) => setGroup({ ...group, rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  if (rules.length === 0) {
    return (
      <div className="space-y-2 p-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.03]">
        <p className={help}>Need more than one check, numbers, lists, a field inside JSON, or the judge&apos;s score?</p>
        <button
          type="button"
          onClick={() => setGroup({ mode: 'all', rules: [{ field: '', op: 'contains', value: data.conditionValue || '' }] })}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3 h-3" /> Use smart rules
        </button>
        <TryIt
          sample={sample}
          render={(t) => {
            const o = evaluateLegacy(data.conditionRule, data.conditionValue, t, testCtx);
            return { ok: o.passed, text: `${o.passed ? 'TRUE' : 'FALSE'}: ${o.reason}` };
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(label, 'text-amber-300')}>Smart rules</span>
        <button
          type="button"
          onClick={() => setGroup({ ...group, rules: [] })}
          className="text-[10px] font-mono text-gray-400 hover:text-white"
          title="Remove the smart rules and use the simple rule above"
        >
          Back to simple rule
        </button>
      </div>
      <p className={help}>These replace the simple rule above while there is at least one.</p>
      <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px] font-mono" role="radiogroup" aria-label="How the rules combine">
        {(['all', 'any'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={group.mode === m}
            onClick={() => setGroup({ ...group, mode: m })}
            className={cn('flex-1 py-1 rounded-md transition-colors', group.mode === m ? 'bg-amber-500/20 text-amber-100' : 'text-gray-400 hover:text-white')}
          >
            {m === 'all' ? 'TRUE when ALL match' : 'TRUE when ANY matches'}
          </button>
        ))}
      </div>
      <ol className="space-y-2">
        {rules.map((r, i) => {
          const info = opInfo(r.op);
          return (
            <li key={i} className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-300/80">Rule {i + 1}</span>
                <button type="button" onClick={() => setGroup({ ...group, rules: rules.filter((_, j) => j !== i) })} className="text-gray-500 hover:text-rose-300" aria-label={`Remove rule ${i + 1}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <input
                value={r.field ?? ''}
                onChange={(e) => setRule(i, { field: e.target.value })}
                placeholder="Look at: the whole answer (or a field, e.g. price)"
                className={cn(field, 'focus:border-amber-400')}
                aria-label="Field to check"
              />
              <OpSelect value={r.op} onChange={(op) => setRule(i, { op })} accent="focus:border-amber-400" />
              {info.valueHint && (
                <input value={r.value ?? ''} onChange={(e) => setRule(i, { value: e.target.value })} placeholder={info.valueHint} className={cn(field, 'focus:border-amber-400')} aria-label="Value" />
              )}
            </li>
          );
        })}
      </ol>
      {rules.length < 6 && (
        <button
          type="button"
          onClick={() => setGroup({ ...group, rules: [...rules, { field: '', op: 'contains', value: '' }] })}
          className="w-full py-1.5 rounded-lg text-[11px] font-mono border border-dashed border-amber-500/30 text-amber-200 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3 h-3" /> Add a rule
        </button>
      )}
      <TryIt
        sample={sample}
        render={(t) => {
          const o = evaluateGroup(group, t, testCtx);
          return { ok: o.passed, text: `${o.passed ? 'TRUE' : 'FALSE'}: ${o.reason}` };
        }}
      />
    </div>
  );
}

/** Prompt: ask for a JSON answer, so Pick from JSON and List Tools can read it. */
export function PromptJsonToggle({ data, onChange }: { data: Patch; onChange: (p: Patch) => void }) {
  const on = data.responseFormat === 'json';
  return (
    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer select-none">
      <input type="checkbox" checked={on} onChange={(e) => onChange({ responseFormat: e.target.checked ? 'json' : 'text' })} className="mt-0.5 accent-copper-500" />
      <span className="space-y-0.5">
        <span className="block text-xs font-semibold text-white">Answer as JSON</span>
        <span className={cn(help, 'block')}>The AI replies with data only, so a Pick from JSON or List Tools step can read it.</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The six new node types

interface V2Props {
  data: Patch;
  onChange: (p: Patch) => void;
  tier: EngineTier;
  /** Text of the connected step(s) from their last run, used for hints and "Try it" */
  upstreamText?: string;
  /** A Switch case was removed: its wire should go too */
  onCaseRemoved?: (caseId: string) => void;
}

export function NodeSettingsV2(props: V2Props) {
  switch (props.data.nodeType) {
    case 'switch':
      return <SwitchSettings {...props} />;
    case 'forEach':
      return <ForEachSettings {...props} />;
    case 'arrayTools':
      return <ArraySettings {...props} />;
    case 'jsonPick':
      return <JsonPickSettings {...props} />;
    case 'variable':
      return <VariableSettings {...props} />;
    case 'askInput':
      return <AskSettings {...props} />;
    default:
      return null;
  }
}

function SwitchSettings({ data, onChange, upstreamText, onCaseRemoved }: V2Props) {
  const cases = (data.switchCases as SwitchCase[] | undefined) ?? [];
  const setCase = (i: number, patch: Partial<SwitchCase>) => onChange({ switchCases: cases.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-3 p-3 bg-orange-500/5 rounded-xl border border-orange-500/20">
      <span className={cn(label, 'text-orange-300')}>
        <Signpost className="w-3.5 h-3.5 text-orange-400" /> Paths
      </span>
      <p className={help}>Checked from top to bottom. The first case that matches sends the input down its coloured dot; if none match, it goes to “default”.</p>
      <input
        value={data.switchField ?? ''}
        onChange={(e) => onChange({ switchField: e.target.value })}
        placeholder="Look at: the whole input (or a field, e.g. category)"
        className={cn(field, 'focus:border-orange-400')}
        aria-label="Field to check"
      />
      <ol className="space-y-2">
        {cases.map((c, i) => {
          const info = opInfo(c.op);
          return (
            <li key={c.id} className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border-2" style={{ borderColor: CASE_COLORS[i % CASE_COLORS.length] }} aria-hidden="true" />
                <input
                  value={c.label}
                  onChange={(e) => setCase(i, { label: e.target.value })}
                  placeholder={`Case ${i + 1} name`}
                  className={cn(field, 'py-1 focus:border-orange-400')}
                  aria-label={`Case ${i + 1} name`}
                />
                <button
                  type="button"
                  onClick={() => {
                    onChange({ switchCases: cases.filter((_, j) => j !== i) });
                    onCaseRemoved?.(c.id);
                  }}
                  className="text-gray-500 hover:text-rose-300 shrink-0"
                  aria-label={`Remove case ${c.label || i + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <OpSelect value={c.op} onChange={(op) => setCase(i, { op })} accent="focus:border-orange-400" />
              {info.valueHint && (
                <input value={c.value ?? ''} onChange={(e) => setCase(i, { value: e.target.value })} placeholder={info.valueHint} className={cn(field, 'focus:border-orange-400')} aria-label={`Case ${i + 1} value`} />
              )}
            </li>
          );
        })}
      </ol>
      {cases.length < MAX_SWITCH_CASES ? (
        <button
          type="button"
          onClick={() => onChange({ switchCases: [...cases, { id: newCaseId(), label: `Case ${cases.length + 1}`, op: 'contains', value: '' }] })}
          className="w-full py-1.5 rounded-lg text-[11px] font-mono border border-dashed border-orange-500/30 text-orange-200 hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3 h-3" /> Add a case
        </button>
      ) : (
        <p className={help}>{MAX_SWITCH_CASES} cases is the most one Switch can hold.</p>
      )}
      <TryIt
        sample={upstreamText}
        render={(t) => {
          for (const c of cases) {
            const o = evaluateRule({ field: data.switchField, op: c.op, value: c.value }, t, testCtx);
            if (o.passed) return { ok: true, text: `Goes to "${c.label || c.id}": ${o.reason}` };
          }
          return { ok: false, text: 'Goes to "default": no case matched' };
        }}
      />
    </div>
  );
}

const TEMPLATE_CHIPS = ['{{item}}', '{{index}}', '{{item.name}}', '{{vars.topic}}'];

function ForEachSettings({ data, onChange, tier }: V2Props) {
  const mode = data.forEachMode ?? 'template';
  const planCap = ENGINE_LIMITS[tier]?.maxForEachItems ?? ENGINE_LIMITS.free.maxForEachItems;
  const capLabel = Number.isFinite(planCap) ? String(planCap) : 'many';
  return (
    <div className="space-y-3 p-3 bg-sky-500/5 rounded-xl border border-sky-500/20">
      <span className={cn(label, 'text-sky-300')}>
        <Repeat className="w-3.5 h-3.5 text-sky-400" /> For every item
      </span>
      <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px] font-mono" role="radiogroup" aria-label="What to do for each item">
        {(['template', 'ai'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onChange({ forEachMode: m })}
            className={cn('flex-1 py-1 rounded-md transition-colors', mode === m ? 'bg-sky-500/20 text-sky-100' : 'text-gray-400 hover:text-white')}
          >
            {m === 'template' ? 'Fill a template' : 'Ask the AI'}
          </button>
        ))}
      </div>
      <p className={help}>
        {mode === 'ai'
          ? 'The AI gets the text below once per item (one AI call each). Pick the model further down.'
          : 'Each item fills in the text below. No AI, so it is instant and free.'}
      </p>
      <textarea
        value={data.forEachTemplate ?? ''}
        onChange={(e) => onChange({ forEachTemplate: e.target.value })}
        rows={4}
        placeholder={mode === 'ai' ? 'Write a one-line slogan for {{item}}' : '{{index}}. {{item}}'}
        className={cn(field, 'resize-y custom-scrollbar focus:border-sky-400 leading-relaxed')}
        aria-label="Template"
      />
      <div className="flex flex-wrap gap-1">
        {TEMPLATE_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ forEachTemplate: `${data.forEachTemplate ?? ''}${c}` })}
            className={cn(chip, 'border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20')}
            title="Add to the end of the template"
          >
            {c}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-gray-300">Most items to use</span>
        <input
          type="number"
          min={1}
          max={Number.isFinite(planCap) ? planCap : undefined}
          value={data.forEachMaxItems ?? ''}
          onChange={(e) => onChange({ forEachMaxItems: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : undefined })}
          placeholder={capLabel}
          className={cn(field, 'w-20 text-center focus:border-sky-400')}
        />
      </label>
      <p className="text-[10px] font-mono text-gray-500">Your plan allows up to {capLabel} items per For Each step.</p>
    </div>
  );
}

function ArraySettings({ data, onChange }: V2Props) {
  const current = ARRAY_OP_INFO.find((o) => o.id === data.arrayOp) ?? ARRAY_OP_INFO[0];
  return (
    <div className="space-y-3 p-3 bg-lime-500/5 rounded-xl border border-lime-500/20">
      <span className={cn(label, 'text-lime-300')}>
        <ListFilter className="w-3.5 h-3.5 text-lime-400" /> What to do with the list
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {ARRAY_OP_INFO.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange({ arrayOp: o.id })}
            className={cn(
              'text-left px-2 py-1.5 rounded-lg border text-[11px] transition-colors',
              current.id === o.id ? 'bg-lime-500/15 border-lime-400/50 text-white' : 'bg-black/30 border-white/5 text-gray-300 hover:bg-white/5 hover:text-white'
            )}
            title={o.help}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className={help}>{current.help}</p>
      {current.needsArg && (
        <input
          value={data.arrayArg ?? ''}
          onChange={(e) => onChange({ arrayArg: e.target.value })}
          placeholder={current.argHint}
          className={cn(field, 'focus:border-lime-400')}
          aria-label="Setting"
        />
      )}
    </div>
  );
}

const PATH_EXAMPLES = ['items[0]', 'items[0].title', 'user.name', 'count'];

function JsonPickSettings({ data, onChange, upstreamText }: V2Props) {
  const found = useMemo(() => listJsonPaths(upstreamText), [upstreamText]);
  const suggestions = found.length ? found : PATH_EXAMPLES;
  return (
    <div className="space-y-3 p-3 bg-fuchsia-500/5 rounded-xl border border-fuchsia-500/20">
      <span className={cn(label, 'text-fuchsia-300')}>
        <Braces className="w-3.5 h-3.5 text-fuchsia-400" /> Which value
      </span>
      <input
        value={data.jsonPath ?? ''}
        onChange={(e) => onChange({ jsonPath: e.target.value })}
        placeholder="e.g. items[0].title"
        className={cn(field, 'focus:border-fuchsia-400')}
        aria-label="Field path"
      />
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">{found.length ? 'Found in the connected result' : 'Examples'}</span>
        <div className="flex flex-wrap gap-1">
          {suggestions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ jsonPath: p })}
              className={cn(chip, data.jsonPath === p ? 'border-fuchsia-400/60 bg-fuchsia-500/25 text-white' : 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <p className={help}>Dots go into an object, [0] is the first item of a list.</p>
      <label className="block space-y-1">
        <span className="text-[11px] text-gray-300">If it is not there, use</span>
        <input value={data.jsonFallback ?? ''} onChange={(e) => onChange({ jsonFallback: e.target.value })} placeholder="(leave empty to show an error)" className={cn(field, 'focus:border-fuchsia-400')} />
      </label>
    </div>
  );
}

function VariableSettings({ data, onChange }: V2Props) {
  const [copied, setCopied] = useState(false);
  const name = data.variableName ?? '';
  const valid = VARIABLE_NAME_RE.test(name);
  const token = `{{vars.${name || 'name'}}}`;
  return (
    <div className="space-y-3 p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
      <span className={cn(label, 'text-cyan-300')}>
        <Variable className="w-3.5 h-3.5 text-cyan-400" /> Name
      </span>
      <input
        value={name}
        onChange={(e) => onChange({ variableName: e.target.value.replace(/\s+/g, '_') })}
        placeholder="topic"
        className={cn(field, 'focus:border-cyan-400', name && !valid && 'border-rose-500/60')}
        aria-invalid={Boolean(name) && !valid}
        aria-label="Variable name"
      />
      {name && !valid && <p className="text-[11px] text-rose-300">Use letters, numbers or _, and start with a letter (e.g. topic, user_name).</p>}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-cyan-500/20 bg-black/40 px-2.5 py-2">
        <span className="text-[11px] text-gray-300">
          Use it later as <code className="font-mono text-cyan-200">{token}</code>
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(token).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-gray-400 hover:text-white shrink-0"
          aria-label="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className={help}>It saves whatever is connected to it. Any later Prompt or For Each step can use it, even ones that are not wired to it directly.</p>
    </div>
  );
}

function AskSettings({ data, onChange }: V2Props) {
  return (
    <div className="space-y-3 p-3 bg-pink-500/5 rounded-xl border border-pink-500/20">
      <span className={cn(label, 'text-pink-300')}>
        <MessageCircleQuestion className="w-3.5 h-3.5 text-pink-400" /> Question
      </span>
      <input value={data.askQuestion ?? ''} onChange={(e) => onChange({ askQuestion: e.target.value })} placeholder="What topic should I use?" className={cn(field, 'focus:border-pink-400')} aria-label="Question" />
      <label className="block space-y-1">
        <span className="text-[11px] text-gray-300">Suggested answer (optional)</span>
        <input value={data.askDefault ?? ''} onChange={(e) => onChange({ askDefault: e.target.value })} placeholder="e.g. coffee shops" className={cn(field, 'focus:border-pink-400')} />
      </label>
      <p className={help}>When the workflow reaches this step, a small window asks you. Your answer becomes this step&apos;s result.</p>
    </div>
  );
}
