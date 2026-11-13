import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { SwitchCase, WorkflowNodeData } from '../../lib/workflowEngine';
import { ARRAY_OP_INFO, CASE_COLORS, opInfo, summarizeV2 } from './nodeTypesV2';

const TARGET_HANDLE =
  '!w-3 !h-3 !bg-sf-121417 !border-2 !border-zinc-400 hover:!border-copper-400 hover:!bg-copper-500/20 transition-all cursor-crosshair z-30';

/** Switch: one coloured output dot per case, plus a grey "default" dot at the bottom of the list. */
export function SwitchHandles({ id, cases }: { id: string; cases: SwitchCase[] }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const signature = cases.map((c) => c.id).join('|');
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, signature, updateNodeInternals]);

  const slots = cases.length + 1;
  const top = (i: number) => `${Math.round(((i + 1) / (slots + 1)) * 100)}%`;
  return (
    <>
      <Handle type="target" id="left" position={Position.Left} className={TARGET_HANDLE} />
      <Handle type="target" id="top" position={Position.Top} className={TARGET_HANDLE} />
      {cases.map((c, i) => (
        <Handle
          key={c.id}
          type="source"
          id={`case:${c.id}`}
          position={Position.Right}
          style={{ top: top(i), background: '#0c0e14', borderColor: CASE_COLORS[i % CASE_COLORS.length] }}
          className="!w-3 !h-3 !border-2 hover:scale-125 transition-all cursor-crosshair z-30"
          title={`Case: ${c.label || c.id}`}
        />
      ))}
      <Handle
        type="source"
        id="default"
        position={Position.Right}
        style={{ top: top(cases.length) }}
        className="!w-3 !h-3 !bg-sf-121417 !border-2 !border-zinc-500 hover:scale-125 transition-all cursor-crosshair z-30"
        title="Default: when no case matches"
      />
    </>
  );
}

/** Labels next to the switch dots, so people can see which wire is which. */
function SwitchLabels({ cases }: { cases: SwitchCase[] }) {
  const slots = cases.length + 1;
  const top = (i: number) => `${Math.round(((i + 1) / (slots + 1)) * 100)}%`;
  return (
    <div className="absolute right-3 top-0 bottom-0 pointer-events-none">
      {cases.map((c, i) => (
        <span
          key={c.id}
          className="absolute right-0 -translate-y-1/2 text-[8px] font-mono font-bold px-1 rounded border bg-black/60 max-w-[80px] truncate"
          style={{ top: top(i), color: CASE_COLORS[i % CASE_COLORS.length], borderColor: `${CASE_COLORS[i % CASE_COLORS.length]}66` }}
        >
          {(c.label || c.id).toUpperCase()}
        </span>
      ))}
      <span
        className="absolute right-0 -translate-y-1/2 text-[8px] font-mono font-bold px-1 rounded border bg-black/60 text-zinc-400 border-zinc-500/40"
        style={{ top: top(cases.length) }}
      >
        DEFAULT
      </span>
    </div>
  );
}

/** What a v2 node shows on the canvas: one line that says what it will do, plus its key setting. */
export function NodeBodyV2({ data }: { data: Partial<WorkflowNodeData> }) {
  const summary = summarizeV2(data);
  const cases = (data.switchCases as SwitchCase[] | undefined) ?? [];
  return (
    <>
      {data.nodeType === 'switch' && <SwitchLabels cases={cases} />}
      <div className="text-[11px] font-mono rounded-lg border border-white/10 bg-black/40 p-2 text-gray-300 leading-relaxed pr-20 min-h-[38px]">
        {data.nodeType === 'switch' && (
          <div className="space-y-0.5">
            {cases.slice(0, 4).map((c) => (
              <div key={c.id} className="truncate">
                <span className="text-orange-300">{c.label || c.id}</span>: {opInfo(c.op).label} {c.value ? `"${c.value}"` : ''}
              </div>
            ))}
            {cases.length > 4 && <div className="text-gray-500">+{cases.length - 4} more</div>}
            {cases.length === 0 && <div className="text-gray-500">{summary}</div>}
          </div>
        )}
        {data.nodeType === 'forEach' && (
          <div className="space-y-1">
            <div className="text-sky-300">{summary}</div>
            <div className="truncate text-gray-400">{data.forEachTemplate || '{{item}}'}</div>
          </div>
        )}
        {data.nodeType === 'arrayTools' && (
          <div className="space-y-1">
            <div className="text-lime-300">{(ARRAY_OP_INFO.find((o) => o.id === data.arrayOp) ?? ARRAY_OP_INFO[0]).label}</div>
            {data.arrayArg ? <div className="truncate text-gray-400">{data.arrayArg}</div> : null}
          </div>
        )}
        {data.nodeType === 'jsonPick' && <div className="truncate text-fuchsia-300">{data.jsonPath || 'set a path, e.g. items[0].title'}</div>}
        {data.nodeType === 'variable' && <div className="truncate text-cyan-300">{`{{vars.${data.variableName || 'name'}}}`}</div>}
        {data.nodeType === 'askInput' && <div className="text-pink-200 line-clamp-2">{data.askQuestion || 'Ask a question'}</div>}
      </div>
    </>
  );
}
