import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  Handle,
  Position,
  BackgroundVariant,
  ConnectionMode,
  ReactFlowProvider,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  useUpdateNodeInternals,
  type EdgeProps,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AI_AGENTS, AgentIcon } from '../components/ui/RichInput';
import { testPrompt, saveWorkflow, loadWorkflows } from '../lib/api';
import {
  Bot,
  Sparkles,
  Terminal,
  Database,
  GitFork,
  Code2,
  GitMerge,
  ShieldCheck,
  Check,
  Copy,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const NODE_CONFIG = {
  system: { 
    title: 'System Persona', 
    desc: 'Sets authoritative persona & behavioral rules', 
    tag: 'SYS', 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    hoverBorder: 'hover:border-blue-500/60',
    icon: Bot,
    paletteShape: 'rounded-t-xl rounded-b-xs'
  },
  prompt: { 
    title: 'User Prompt', 
    desc: 'Core driver with dynamic variable templating', 
    tag: 'PROMPT', 
    color: 'text-copper-400', 
    bg: 'bg-copper-500/10',
    border: 'border-copper-500/30',
    hoverBorder: 'hover:border-copper-500/60',
    icon: Sparkles,
    paletteShape: 'rounded-xl rounded-bl-xs'
  },
  output: { 
    title: 'Terminal Output', 
    desc: 'CRT screen for validation, inspection & export', 
    tag: 'OUT', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    hoverBorder: 'hover:border-emerald-500/70',
    icon: Terminal,
    paletteShape: 'rounded-full'
  },
  data: { 
    title: 'Data Store', 
    desc: 'Injects structured JSON, documents & key-values', 
    tag: 'DATA', 
    color: 'text-purple-400', 
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    hoverBorder: 'hover:border-purple-500/60',
    icon: Database,
    paletteShape: 'rounded-tl-xl rounded-br-xl rounded-tr-xs rounded-bl-xs'
  },
  condition: { 
    title: 'Branch Condition', 
    desc: 'Decision router branching to TRUE or FALSE', 
    tag: 'BRANCH', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    hoverBorder: 'hover:border-amber-500/70',
    icon: GitFork,
    paletteShape: 'rotate-45 scale-75 rounded-xs'
  },
  code: { 
    title: 'Transform Script', 
    desc: 'Runs JavaScript snippets on upstream inputs', 
    tag: 'CODE', 
    color: 'text-rose-400', 
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    hoverBorder: 'hover:border-rose-500/60',
    icon: Code2,
    paletteShape: 'border-l-2 border-l-rose-500 rounded-tr-md rounded-b-md'
  },
  merge: { 
    title: 'Merge Aggregator', 
    desc: 'Combines multiple upstream streams into one', 
    tag: 'MERGE', 
    color: 'text-teal-400', 
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    hoverBorder: 'hover:border-teal-500/60',
    icon: GitMerge,
    paletteShape: 'rounded-l-xl rounded-r-xs'
  },
  evaluation: { 
    title: 'Quality Judge', 
    desc: 'Automated AI evaluator scoring on a 0-100 rubric', 
    tag: 'EVAL', 
    color: 'text-indigo-400', 
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/35',
    hoverBorder: 'hover:border-indigo-500/65',
    icon: ShieldCheck,
    paletteShape: 'rounded-t-xs rounded-b-xl'
  }
};

export const SYSTEM_PERSONAS = [
  { id: 'architect', name: 'Software Architect', desc: 'You are a Senior AI & Software Architect. Provide robust, clean, scalable architectures with strict type safety and best practices.' },
  { id: 'reviewer', name: 'Code Reviewer', desc: 'You are a strict Senior Code Reviewer. Audit for performance bottlenecks, edge cases, vulnerabilities, and code smell.' },
  { id: 'writer', name: 'Creative Writer', desc: 'You are a world-class copywriter and storyteller. Produce clear, persuasive, and evocative explanations.' },
  { id: 'json_bot', name: 'Strict JSON Formatter', desc: 'You are a strict data formatting engine. Output valid parseable JSON conforming exactly to the requested schema. No conversational prose.' },
  { id: 'concise', name: 'Concise Assistant', desc: 'Be extremely concise. Answer directly in bullet points without introductory greetings or polite closing remarks.' }
];

export const DATA_PRESETS = [
  {
    id: 'user_profile',
    name: 'User Profile Context',
    data: JSON.stringify({ userId: 'usr_9421', tier: 'enterprise', role: 'architect', permissions: ['ai.invoke', 'pipeline.deploy'] }, null, 2)
  },
  {
    id: 'api_mock',
    name: 'API Mock Data',
    data: JSON.stringify({ status: 200, count: 2, items: [{ id: 'res_1', title: 'Neural Branching' }, { id: 'res_2', title: 'Vector Store' }] }, null, 2)
  },
  {
    id: 'pipeline_config',
    name: 'Pipeline Config',
    data: JSON.stringify({ environment: 'production', region: 'us-east-1', timeoutMs: 5000, maxRetries: 3 }, null, 2)
  }
];

export const CODE_TEMPLATES = [
  { id: 'uppercase', name: 'To Uppercase', code: '// Convert upstream text to uppercase\nreturn input.trim().toUpperCase();' },
  { id: 'json_parse', name: 'Parse & Format JSON', code: '// Pretty-print valid JSON or return original\ntry {\n  const obj = JSON.parse(input);\n  return JSON.stringify(obj, null, 2);\n} catch (e) {\n  return input;\n}' },
  { id: 'word_count', name: 'Word Counter', code: '// Calculate input statistics\nconst count = input.trim().split(/\\s+/).filter(Boolean).length;\nreturn `[Metrics]\\nWord Count: ${count}\\nLength: ${input.length} chars\\n\\n${input}`;' },
  { id: 'extract_code', name: 'Extract Code Blocks', code: '// Extract code from markdown fences\nconst match = input.match(/```(?:[a-z]*)\\n([\\s\\S]*?)```/i);\nreturn match ? match[1].trim() : input;' }
];

export const EVAL_CRITERIA = [
  { id: 'accuracy', name: 'Accuracy & Reliability' },
  { id: 'clarity', name: 'Clarity & Concise Tone' },
  { id: 'code_quality', name: 'Code Quality & Safety' },
  { id: 'guardrails', name: 'Policy & Guardrails' }
];

export const MERGE_STRATEGIES = [
  { id: 'concat', name: 'Concatenate with Divider (---)' },
  { id: 'bullets', name: 'Bulleted Streams List' },
  { id: 'json', name: 'JSON Array Payload' },
  { id: 'synthesize', name: 'AI Synthesize & Summarize' }
];

export type PromptNodeData = {
  title: string;
  description: string;
  agentId: string;
  modelId: string;
  status: 'idle' | 'running' | 'success' | 'error';
  nodeType: keyof typeof NODE_CONFIG;
  output?: string;
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
};

// Custom Edge with Delete Button
const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: selected ? 3 : 2, stroke: selected ? '#ff9b71' : '#fff' }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 flex items-center justify-center bg-[#1a1a1a] border border-white/20 rounded-full text-gray-400 hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10 transition-colors shadow-lg font-mono text-xs leading-none"
            onClick={onEdgeClick}
            title="Delete Connection"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Generic Node component with Unique Shapes and Specialized Roles
const GenericNode = ({ id, data, selected }: { id: string, data: PromptNodeData, selected: boolean }) => {
  const { setNodes, getNodes, getEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [copied, setCopied] = useState(false);
  
  const agent = AI_AGENTS.find(a => a.id === data.agentId) || AI_AGENTS[0];
  const model = agent.models.find(m => m.id === data.modelId) || agent.models[0];
  const config = NODE_CONFIG[data.nodeType] || NODE_CONFIG.prompt;
  const IconComponent = config.icon;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data, updateNodeInternals]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, status: 'running', output: undefined } } : n));
    
    try {
      const edges = getEdges();
      const allNodes = getNodes() as Node<PromptNodeData>[];
      
      const incomingEdges = edges.filter(e => e.target === id);
      const parentNodes = incomingEdges.map(e => allNodes.find(n => n.id === e.source)).filter(Boolean) as Node<PromptNodeData>[];
      
      const upstreamText = parentNodes
        .map(p => p.data.output || p.data.description || p.data.title)
        .filter(Boolean)
        .join('\n\n');

      let outputResult = '';
      let extraData: Partial<PromptNodeData> = {};

      switch (data.nodeType) {
        case 'system': {
          outputResult = data.description || 'System persona active.';
          break;
        }

        case 'data': {
          const payload = data.dataPayload || data.description;
          try {
            const parsed = JSON.parse(payload);
            outputResult = JSON.stringify(parsed, null, 2);
          } catch {
            outputResult = payload;
          }
          break;
        }

        case 'code': {
          const script = data.codeScript || 'return input;';
          try {
            const runner = new Function('input', script);
            const res = runner(upstreamText || data.description);
            outputResult = typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res);
          } catch (err: any) {
            throw new Error(`Code execution error: ${err.message}`);
          }
          break;
        }

        case 'condition': {
          const rule = data.conditionRule || 'contains';
          const targetVal = (data.conditionValue || '').trim().toLowerCase();
          const testText = (upstreamText || data.description).toLowerCase();
          
          let passed = false;
          if (rule === 'contains') {
            passed = testText.includes(targetVal);
          } else if (rule === 'not_contains') {
            passed = !testText.includes(targetVal);
          } else if (rule === 'length_gt') {
            passed = testText.length > (parseInt(targetVal, 10) || 0);
          } else if (rule === 'regex') {
            try {
              const re = new RegExp(targetVal, 'i');
              passed = re.test(testText);
            } catch {
              passed = false;
            }
          }
          extraData.conditionResult = passed;
          outputResult = passed 
            ? `✓ [TRUE PATH]: Rule passed ("${data.conditionValue || 'match'}")` 
            : `✗ [FALSE PATH]: Rule failed ("${data.conditionValue || 'mismatch'}")`;
          break;
        }

        case 'merge': {
          const strategy = data.mergeStrategy || 'concat';
          if (strategy === 'concat') {
            outputResult = parentNodes.map(p => `--- Source: ${p.data.title} ---\n${p.data.output || p.data.description}`).join('\n\n');
          } else if (strategy === 'bullets') {
            outputResult = parentNodes.map(p => `• [${p.data.title}]: ${p.data.output || p.data.description}`).join('\n');
          } else if (strategy === 'json') {
            outputResult = JSON.stringify(parentNodes.map(p => ({ source: p.data.title, content: p.data.output || p.data.description })), null, 2);
          } else if (strategy === 'synthesize') {
            const synthesisPrompt = `Synthesize and unify these ${parentNodes.length} workflow branches into a coherent output:\n\n${upstreamText}`;
            outputResult = await testPrompt(data.modelId, 'You are an expert synthesizer. Merge all context into a single coherent output.', synthesisPrompt);
          }
          break;
        }

        case 'evaluation': {
          const criteriaLabel = EVAL_CRITERIA.find(c => c.id === data.evalCriteria)?.name || 'Factual Accuracy & Reliability';
          const evalPrompt = `You are an expert AI Judge. Grade the following output strictly based on: "${criteriaLabel}".
Provide your evaluation in this EXACT format:
SCORE: [number between 0 and 100]
FEEDBACK: [1 to 2 sentences explaining the grade]

Content to evaluate:
${upstreamText || data.description}`;

          const rawEval = await testPrompt(data.modelId, 'You are an objective AI evaluator.', evalPrompt);
          const scoreMatch = rawEval.match(/SCORE:\s*(\d+)/i);
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 88;
          const feedbackMatch = rawEval.match(/FEEDBACK:\s*([\s\S]+)/i);
          const critique = feedbackMatch ? feedbackMatch[1].trim() : rawEval;

          extraData.evalScore = Math.min(100, Math.max(0, score));
          extraData.evalCritique = critique;
          outputResult = `Score: ${extraData.evalScore}/100\nFeedback: ${critique}`;
          break;
        }

        case 'output': {
          outputResult = upstreamText || data.description || 'Terminal ready. Run upstream nodes to feed output.';
          break;
        }

        case 'prompt':
        default: {
          const sysPrompt = parentNodes.filter(p => p.data.nodeType === 'system').map(p => p.data.output || p.data.description).join('\n\n');
          const userPrompt = data.description || data.title;
          outputResult = await testPrompt(data.modelId, sysPrompt || upstreamText, userPrompt);
          break;
        }
      }
      
      setNodes(nodes => nodes.map(n => n.id === id ? { 
        ...n, 
        data: { 
          ...n.data, 
          ...extraData, 
          status: 'success', 
          output: outputResult 
        } 
      } : n));
    } catch (err: any) {
      console.error(err);
      setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, status: 'error', output: err.message || 'Execution failed' } } : n));
    }
  };

  const detectedVars = Array.from(new Set((data.description.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || []).map(v => v.replace(/[{}]/g, ''))));

  const getShapeClasses = () => {
    switch (data.nodeType) {
      case 'system':
        return cn(
          "w-[290px] rounded-t-[28px] rounded-b-xl border bg-gradient-to-b from-[#101624]/95 via-[#0e121b]/95 to-[#0b0e14]/95",
          selected ? "border-blue-400 shadow-[0_0_35px_rgba(59,130,246,0.35)] ring-1 ring-blue-400/50" : "border-blue-500/30 hover:border-blue-500/60 shadow-[0_4px_25px_rgba(59,130,246,0.12)]"
        );
      case 'prompt':
        return cn(
          "w-[290px] rounded-2xl rounded-bl-xs border bg-gradient-to-b from-[#211612]/95 via-[#181210]/95 to-[#120f0d]/95",
          selected ? "border-copper-400 shadow-[0_0_35px_rgba(255,155,113,0.35)] ring-1 ring-copper-400/50" : "border-copper-500/35 hover:border-copper-500/65 shadow-[0_4px_25px_rgba(255,155,113,0.15)]"
        );
      case 'output':
        return cn(
          "w-[300px] rounded-2xl border-2 bg-gradient-to-b from-[#0b1712]/95 via-[#08120e]/95 to-[#050b08]/95",
          selected ? "border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/50" : "border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.16)]"
        );
      case 'data':
        return cn(
          "w-[290px] rounded-tl-2xl rounded-br-2xl rounded-tr-md rounded-bl-md border bg-gradient-to-br from-[#1b1126]/95 via-[#140e1d]/95 to-[#0d0914]/95",
          selected ? "border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.35)] ring-1 ring-purple-400/50" : "border-purple-500/30 hover:border-purple-500/60 shadow-[0_4px_25px_rgba(168,85,247,0.14)]"
        );
      case 'condition':
        return cn(
          "w-[300px] rounded-xl border relative bg-gradient-to-b from-[#20180d]/95 via-[#171109]/95 to-[#110d06]/95",
          selected ? "border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/50" : "border-amber-500/40 hover:border-amber-500/70 shadow-[0_4px_25px_rgba(245,158,11,0.15)]"
        );
      case 'code':
        return cn(
          "w-[300px] rounded-tr-xl rounded-b-xl rounded-tl-none border-l-4 border-l-rose-500 border-t border-r border-b bg-[#0e1014]/95",
          selected ? "border-rose-400 shadow-[0_0_35px_rgba(244,63,94,0.35)] ring-1 ring-rose-400/50" : "border-rose-500/30 hover:border-rose-500/60 shadow-[0_4px_25px_rgba(244,63,94,0.14)]"
        );
      case 'merge':
        return cn(
          "w-[290px] rounded-l-3xl rounded-r-lg border bg-gradient-to-r from-teal-950/40 via-[#0e1818]/95 to-[#101417]/95",
          selected ? "border-teal-400 shadow-[0_0_35px_rgba(20,184,166,0.35)] ring-1 ring-teal-400/50" : "border-teal-500/30 hover:border-teal-500/60 shadow-[0_4px_25px_rgba(20,184,166,0.14)]"
        );
      case 'evaluation':
        return cn(
          "w-[290px] rounded-t-xl rounded-b-[36px] border bg-gradient-to-b from-[#181335]/95 via-[#120f26]/95 to-[#0b0818]/95",
          selected ? "border-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/50" : "border-indigo-500/35 hover:border-indigo-500/65 shadow-[0_4px_30px_rgba(99,102,241,0.2)]"
        );
      default:
        return "w-[280px] rounded-xl border bg-[#1a1a1a]/95 border-white/10";
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col backdrop-blur-xl transition-all duration-200 shadow-2xl animate-in fade-in duration-150 group",
        getShapeClasses()
      )}
    >
      {/* Handles */}
      {data.nodeType === 'condition' ? (
        <>
          <Handle
            type="target"
            id="left"
            position={Position.Left}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-amber-400 hover:!bg-amber-500/20 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="target"
            id="top"
            position={Position.Top}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-amber-400 hover:!bg-amber-500/20 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            style={{ top: '35%' }}
            className="!w-3 !h-3 !bg-[#062615] !border-2 !border-emerald-400 hover:!bg-emerald-400 hover:scale-125 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            style={{ top: '70%' }}
            className="!w-3 !h-3 !bg-[#2a0b12] !border-2 !border-rose-400 hover:!bg-rose-400 hover:scale-125 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="bottom"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-amber-400 hover:!bg-amber-500/20 transition-all cursor-crosshair z-30"
          />
        </>
      ) : data.nodeType === 'merge' ? (
        <>
          <Handle
            type="target"
            id="in-1"
            position={Position.Left}
            style={{ top: '35%' }}
            className="!w-3 !h-3 !bg-[#0b2424] !border-2 !border-teal-400 hover:scale-125 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="target"
            id="in-2"
            position={Position.Left}
            style={{ top: '70%' }}
            className="!w-3 !h-3 !bg-[#0b2424] !border-2 !border-teal-400 hover:scale-125 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="target"
            id="top"
            position={Position.Top}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-teal-400 hover:!bg-teal-500/20 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="right"
            position={Position.Right}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-teal-400 hover:!bg-teal-400 hover:scale-125 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="bottom"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-teal-400 hover:!bg-teal-500/20 transition-all cursor-crosshair z-30"
          />
        </>
      ) : (
        <>
          <Handle
            type="target"
            id="left"
            position={Position.Left}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-copper-400 hover:!bg-copper-500/20 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="target"
            id="top"
            position={Position.Top}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-copper-400 hover:!bg-copper-500/20 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="right"
            position={Position.Right}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-copper-400 hover:!bg-copper-500/20 transition-all cursor-crosshair z-30"
          />
          <Handle
            type="source"
            id="bottom"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-[#121417] !border-2 !border-zinc-400 hover:!border-copper-400 hover:!bg-copper-500/20 transition-all cursor-crosshair z-30"
          />
        </>
      )}

      {/* NODE HEADER */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-b",
        data.nodeType === 'system' && "rounded-t-[27px] bg-gradient-to-b from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/20",
        data.nodeType === 'prompt' && "rounded-t-2xl bg-copper-500/10 border-copper-500/20",
        data.nodeType === 'output' && "rounded-t-xl bg-emerald-500/15 border-emerald-500/30",
        data.nodeType === 'data' && "rounded-tl-2xl rounded-tr-md bg-purple-500/10 border-purple-500/20",
        data.nodeType === 'condition' && "rounded-t-xl bg-amber-500/15 border-amber-500/20",
        data.nodeType === 'code' && "rounded-tr-xl bg-rose-500/10 border-rose-500/20",
        data.nodeType === 'merge' && "rounded-tl-3xl rounded-tr-lg bg-teal-500/15 border-teal-500/20",
        data.nodeType === 'evaluation' && "rounded-t-xl bg-indigo-500/15 border-indigo-500/25"
      )}>
        <div className="flex items-center gap-2">
          {data.nodeType === 'output' && (
            <div className="flex items-center gap-1 mr-1">
              <span className="w-2 h-2 rounded-full bg-red-400/80 inline-block" />
              <span className="w-2 h-2 rounded-full bg-yellow-400/80 inline-block" />
              <span className="w-2 h-2 rounded-full bg-emerald-400/80 inline-block" />
            </div>
          )}
          <span className={cn("font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/50 border border-white/10 flex items-center gap-1", config.color)}>
            <IconComponent className="w-3 h-3" />
            {config.tag}
          </span>
          <span className="text-[11px] font-semibold tracking-wide uppercase text-white/80">
            {config.title}
          </span>
        </div>

        {data.nodeType === 'output' ? (
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 uppercase">
            CRT TERMINAL
          </span>
        ) : data.nodeType === 'code' ? (
          <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 uppercase">
            JS RUNNER
          </span>
        ) : data.nodeType === 'data' ? (
          <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30 uppercase">
            {data.dataMode === 'kv' ? 'KV STORE' : 'JSON STORE'}
          </span>
        ) : data.nodeType === 'condition' ? (
          <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
            IF / ELSE
          </span>
        ) : data.nodeType === 'merge' ? (
          <span className="text-[9px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/30 uppercase">
            {data.mergeStrategy || 'CONCAT'}
          </span>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#111] px-2 py-0.5 rounded-md border border-white/5">
            <AgentIcon agent={agent} model={model.id} className="w-3 h-3" badgeClassName="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono text-gray-400 truncate max-w-[75px]">{model.name}</span>
          </div>
        )}
      </div>

      {data.nodeType === 'condition' && (
        <div className="absolute right-3 top-0 bottom-0 pointer-events-none flex flex-col justify-between py-6">
          <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40">
            TRUE
          </span>
          <span className="text-[8px] font-mono font-bold text-rose-400 bg-rose-500/20 px-1 py-0.2 rounded border border-rose-500/40">
            FALSE
          </span>
        </div>
      )}

      {data.nodeType === 'merge' && (
        <div className="absolute left-3 top-0 bottom-0 pointer-events-none flex flex-col justify-between py-6">
          <span className="text-[8px] font-mono font-bold text-teal-400 bg-teal-500/20 px-1 py-0.2 rounded border border-teal-500/40">
            IN 1
          </span>
          <span className="text-[8px] font-mono font-bold text-teal-400 bg-teal-500/20 px-1 py-0.2 rounded border border-teal-500/40">
            IN 2
          </span>
        </div>
      )}

      {/* NODE BODY */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-display font-medium text-[14px] text-white truncate">
            {data.title || 'Untitled Node'}
          </span>

          {data.nodeType === 'evaluation' && data.evalScore !== undefined && (
            <div className={cn(
              "px-2 py-0.5 rounded-full font-mono text-xs font-bold border",
              data.evalScore >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" :
              data.evalScore >= 60 ? "bg-amber-500/15 text-amber-400 border-amber-500/40" :
              "bg-rose-500/15 text-rose-400 border-rose-500/40"
            )}>
              {data.evalScore}/100
            </div>
          )}
        </div>

        {data.nodeType === 'system' && (
          <div className="text-[12px] text-blue-200/80 bg-blue-500/5 p-2 rounded-lg border border-blue-500/20 line-clamp-3 font-mono leading-relaxed">
            {data.description || 'Define system instructions and persona constraints for downstream nodes.'}
          </div>
        )}

        {data.nodeType === 'prompt' && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[13px] text-gray-300 line-clamp-3 leading-relaxed">
              {data.description || <span className="italic opacity-50">Enter user prompt context...</span>}
            </div>
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {detectedVars.map(v => (
                  <span key={v} className="text-[9px] font-mono bg-copper-500/20 text-copper-300 border border-copper-500/30 px-1.5 py-0.5 rounded">
                    &#123;&#123;{v}&#125;&#125;
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {data.nodeType === 'output' && (
          <div className="flex flex-col gap-1.5">
            <div className="p-2.5 bg-black/70 rounded-lg border border-emerald-500/30 text-[11px] font-mono text-emerald-400/90 max-h-[110px] overflow-y-auto custom-scrollbar leading-relaxed">
              {data.output || (
                <span className="italic opacity-50 text-gray-500">
                  Ready. Run connected upstream nodes to populate output stream.
                </span>
              )}
            </div>
            {data.output && (
              <div className="flex items-center justify-between text-[10px] font-mono text-emerald-500/70 pt-0.5">
                <span>{data.output.split(/\s+/).filter(Boolean).length} words · {data.output.length} chars</span>
                <button
                  onClick={() => copyToClipboard(data.output!)}
                  className="hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}

        {data.nodeType === 'data' && (
          <div className="p-2 bg-black/60 rounded-lg border border-purple-500/20 text-[11px] font-mono text-purple-300/90 max-h-[90px] overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap">{data.dataPayload || data.description || '{\n  "status": "ready"\n}'}</pre>
          </div>
        )}

        {data.nodeType === 'condition' && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              Rule: <span className="font-bold uppercase text-amber-200">{data.conditionRule || 'contains'}</span>
              <div className="truncate text-gray-300 mt-0.5">
                Target: "{data.conditionValue || 'keyword'}"
              </div>
            </div>
            {data.conditionResult !== undefined && (
              <div className={cn(
                "text-[10px] font-mono font-bold px-2 py-1 rounded flex items-center gap-1.5 border",
                data.conditionResult ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border-rose-500/40"
              )}>
                {data.conditionResult ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                <span>Active: {data.conditionResult ? 'TRUE BRANCH' : 'FALSE BRANCH'}</span>
              </div>
            )}
          </div>
        )}

        {data.nodeType === 'code' && (
          <div className="p-2 bg-black/70 rounded-lg border border-rose-500/20 text-[11px] font-mono text-rose-300/90 max-h-[80px] overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap">{data.codeScript || '// Transform input\nreturn input.toUpperCase();'}</pre>
          </div>
        )}

        {data.nodeType === 'merge' && (
          <div className="text-[11px] font-mono text-teal-300/90 bg-teal-500/10 p-2 rounded-lg border border-teal-500/20">
            Strategy: <span className="font-semibold text-teal-200 uppercase">{data.mergeStrategy || 'concat'}</span>
            <div className="text-[10px] text-gray-400 mt-0.5">Combines multiple incoming streams</div>
          </div>
        )}

        {data.nodeType === 'evaluation' && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-mono text-indigo-300/90 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
              Criteria: <span className="font-semibold text-indigo-200">{EVAL_CRITERIA.find(c => c.id === data.evalCriteria)?.name || 'Accuracy'}</span>
            </div>
            {data.evalCritique && (
              <div className="text-[11px] text-gray-300 italic bg-white/5 p-2 rounded-lg border border-white/10 max-h-[60px] overflow-y-auto custom-scrollbar">
                "{data.evalCritique}"
              </div>
            )}
          </div>
        )}

        {data.nodeType !== 'output' && data.output && (
          <div className="mt-1 p-2 bg-black/60 rounded-lg border border-white/10 text-[11px] text-gray-300 max-h-[80px] overflow-y-auto custom-scrollbar font-mono">
            {data.output}
          </div>
        )}
      </div>

      {/* NODE FOOTER */}
      <div className={cn(
        "px-3 py-2 border-t border-white/10 bg-black/40 flex items-center justify-between group-[.is-pan-mode]/flow:pointer-events-none",
        data.nodeType === 'system' && 'rounded-b-xl',
        data.nodeType === 'prompt' && 'rounded-b-2xl rounded-bl-xs',
        data.nodeType === 'output' && 'rounded-b-xl',
        data.nodeType === 'data' && 'rounded-br-2xl rounded-bl-md',
        data.nodeType === 'condition' && 'rounded-b-xl',
        data.nodeType === 'code' && 'rounded-b-xl',
        data.nodeType === 'merge' && 'rounded-br-lg rounded-bl-2xl',
        data.nodeType === 'evaluation' && 'rounded-b-[34px] pb-3'
      )}>
        <div className="flex items-center gap-2">
          {data.status === 'running' && <div className="w-2 h-2 border-2 border-copper-500/30 border-t-copper-500 rounded-full animate-spin" />}
          {data.status === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
          {data.status === 'error' && <div className="w-2 h-2 rounded-full bg-rose-400" />}
          {data.status === 'idle' && <div className="w-2 h-2 rounded-full bg-white/20" />}
          <span className="text-[10px] font-mono text-gray-500 uppercase">{data.status}</span>
        </div>
        
        <button 
          onClick={handleRun}
          disabled={data.status === 'running'}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-mono font-medium transition-all nodrag disabled:opacity-50 flex items-center gap-1",
            data.nodeType === 'system' ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" :
            data.nodeType === 'output' ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" :
            data.nodeType === 'condition' ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" :
            data.nodeType === 'code' ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" :
            data.nodeType === 'merge' ? "bg-teal-500/20 text-teal-300 hover:bg-teal-500/30" :
            data.nodeType === 'evaluation' ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30" :
            "bg-copper-500/20 text-copper-300 hover:bg-copper-500/30"
          )}
        >
          {data.nodeType === 'output' ? 'Fetch' : data.nodeType === 'condition' ? 'Test' : data.nodeType === 'code' ? 'Execute' : 'Run'}
        </button>
      </div>
    </div>
  );
};

const nodeTypes = { genericNode: GenericNode };
const edgeTypes = { deletableEdge: DeletableEdge };

// Custom Select Dropdown Component
function CustomSelect({ 
  value, 
  options, 
  onChange, 
  renderValue,
  renderOption 
}: { 
  value: string, 
  options: any[], 
  onChange: (val: string) => void,
  renderValue?: (opt: any) => React.ReactNode,
  renderOption?: (opt: any) => React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white hover:border-white/20 transition-colors focus:outline-none focus:border-copper-500/50 shadow-inner"
      >
        <div className="truncate flex items-center gap-2">
          {renderValue ? renderValue(selected) : selected?.name}
        </div>
        <span className="text-[10px] text-gray-400">▾</span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            onWheel={(e) => e.stopPropagation()}
            className="absolute z-50 w-full mt-1.5 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-x-hidden max-h-[240px] overflow-y-auto custom-scrollbar flex flex-col p-1.5 nowheel nopan nodrag"
          >
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => { onChange(option.id); setIsOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors rounded-lg flex items-center gap-2",
                  value === option.id ? "bg-copper-500/15 text-copper-400 font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white"
                )}
              >
                {renderOption ? renderOption(option) : option.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const initialNodes: Node<PromptNodeData>[] = [
  {
    id: 'node-1',
    type: 'genericNode',
    position: { x: 180, y: 140 },
    data: { 
      title: 'Base Persona', 
      description: 'You are an expert AI Architect. Build robust, clean system architectures.',
      agentId: 'gemini',
      modelId: 'gemini-2.5-flash',
      nodeType: 'system',
      status: 'idle',
      systemPersona: 'architect',
    },
  },
  {
    id: 'node-2',
    type: 'genericNode',
    position: { x: 560, y: 140 },
    data: { 
      title: 'User Prompt', 
      description: 'Generate an API schema for neural workflow graphs.',
      agentId: 'gemini',
      modelId: 'gemini-2.5-flash',
      nodeType: 'prompt',
      status: 'idle',
    },
  },
];
const initialEdges: Edge[] = [];

function FlowEditor() {
  const [nodes, setNodes] = useState<Node<PromptNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [toolMode, setToolMode] = useState<'pan' | 'select'>('select');
  const [workflowTitle, setWorkflowTitle] = useState('Untitled Pipeline');
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [activeSettingsNodeId, setActiveSettingsNodeId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows().then(data => setSavedWorkflows(data)).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      const res = await saveWorkflow({
        id: workflowId,
        title: workflowTitle,
        nodes,
        edges
      });
      setWorkflowId(res.id);
      alert('Workflow saved successfully!');
      const updated = await loadWorkflows();
      setSavedWorkflows(updated);
    } catch (e) {
      alert('Failed to save workflow.');
    }
  };

  const handleLoad = (tree: any) => {
    setWorkflowId(tree.id);
    setWorkflowTitle(tree.title);
    setNodes(JSON.parse(tree.nodes));
    setEdges(JSON.parse(tree.edges));
    setActiveSettingsNodeId(null);
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedIds = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
      if (removedIds.size > 0) {
        setActiveSettingsNodeId((curr) => (curr && removedIds.has(curr) ? null : curr));
      }
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<PromptNodeData>[]);
    },
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'deletableEdge', animated: true, style: { stroke: '#ff9b71', strokeWidth: 2 } }, eds)),
    []
  );
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setActiveSettingsNodeId(node.id);
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.key.toLowerCase() === 'h') {
        setToolMode('pan');
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        setNodes((nds) => {
          const toDelete = new Set(nds.filter((node) => node.selected).map(n => n.id));
          if (toDelete.size > 0) {
            setActiveSettingsNodeId((curr) => (curr && toDelete.has(curr) ? null : curr));
          }
          return nds.filter((node) => !node.selected);
        });
        setEdges((eds) => eds.filter((edge) => !edge.selected));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addNode = (type: keyof typeof NODE_CONFIG = 'prompt') => {
    const config = NODE_CONFIG[type];
    
    let extraInitial: Partial<PromptNodeData> = {};
    if (type === 'system') {
      extraInitial = {
        title: 'System Persona',
        description: SYSTEM_PERSONAS[0].desc,
        systemPersona: 'architect',
      };
    } else if (type === 'data') {
      extraInitial = {
        title: 'Data Store',
        description: 'Structured input parameters',
        dataMode: 'json',
        dataPayload: DATA_PRESETS[0].data,
      };
    } else if (type === 'condition') {
      extraInitial = {
        title: 'Branch Condition',
        description: 'Branch if response contains success',
        conditionRule: 'contains',
        conditionValue: 'success',
      };
    } else if (type === 'code') {
      extraInitial = {
        title: 'Transform Script',
        description: 'Execute custom JavaScript on input',
        codeScript: CODE_TEMPLATES[0].code,
      };
    } else if (type === 'merge') {
      extraInitial = {
        title: 'Context Merger',
        description: 'Unify incoming pipeline branches',
        mergeStrategy: 'concat',
      };
    } else if (type === 'evaluation') {
      extraInitial = {
        title: 'Quality Judge',
        description: 'Evaluate output quality and compliance',
        evalCriteria: 'accuracy',
      };
    } else if (type === 'output') {
      extraInitial = {
        title: 'Terminal Output',
        description: 'Final execution terminal',
        outputFormat: 'markdown',
      };
    }

    const newNode: Node<PromptNodeData> = {
      id: `node-${Date.now()}`,
      type: 'genericNode',
      position: { x: 300 + Math.random() * 50, y: 200 + Math.random() * 50 },
      data: { 
        title: `New ${config.title}`, 
        description: '',
        agentId: 'gemini',
        modelId: 'gemini-2.5-flash',
        nodeType: type,
        status: 'idle',
        ...extraInitial,
      },
    };
    setNodes((nds) => [...nds.map(n => ({...n, selected: false})), { ...newNode, selected: true }]);
    setActiveSettingsNodeId(newNode.id);
  };

  const activeNode = nodes.find(n => n.id === activeSettingsNodeId) || null;

  const onNodeDataChange = (id: string, newData: Partial<PromptNodeData>) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...newData } };
      }
      return n;
    }));
  };

  return (
    <div className={cn(
      "w-full h-full relative flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] group/flow",
      toolMode === 'pan' && "is-pan-mode"
    )}>
      <div className="flex-1 w-full bg-transparent">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'deletableEdge' }}
          connectionMode={ConnectionMode.Loose}
          connectionLineStyle={{ stroke: '#ff9b71', strokeWidth: 2 }}
          panOnDrag={toolMode === 'pan' ? true : [1, 2]}
          selectionOnDrag={toolMode === 'select'}
          selectionMode={SelectionMode.Partial}
          panOnScroll={true}
          fitView
          className="bg-transparent"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.08)" gap={20} size={2} />
        </ReactFlow>
      </div>

      {/* Top Left Toolbar */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="absolute top-6 left-6 z-10 flex items-center gap-3 nowheel nopan nodrag font-mono text-xs"
      >
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a]/80 backdrop-blur-2xl border border-white/10 rounded-xl text-gray-400 shadow-lg shadow-black/20">
          <input 
            type="text" 
            value={workflowTitle}
            onChange={(e) => setWorkflowTitle(e.target.value)}
            className="bg-transparent border-none text-white font-display font-semibold focus:outline-none focus:ring-1 focus:ring-copper-500 rounded px-1 w-32 md:w-48 placeholder-gray-500"
            placeholder="Untitled"
          />
          <div className="w-[1px] h-4 bg-white/20"></div>
          {savedWorkflows.length > 0 && (
            <>
              <select 
                className="bg-transparent border-none text-gray-400 font-mono text-[10px] uppercase focus:outline-none focus:text-white cursor-pointer"
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const tree = savedWorkflows.find(w => w.id === id);
                  if (tree) handleLoad(tree);
                }}
                value={workflowId || ''}
              >
                <option value="">Load...</option>
                {savedWorkflows.map(w => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
              <div className="w-[1px] h-4 bg-white/20"></div>
            </>
          )}
          <button onClick={handleSave} className="hover:text-copper-400 transition-colors">Save</button>
          <div className="w-[1px] h-4 bg-white/20"></div>
          <button onClick={() => { setNodes([]); setEdges([]); setWorkflowId(undefined); setWorkflowTitle('Untitled Pipeline'); setActiveSettingsNodeId(null); }} className="hover:text-red-400 transition-colors">Clear</button>
          <div className="w-[1px] h-4 bg-white/20"></div>
          <span className={toolMode === 'select' ? "text-white font-semibold" : ""}>V:Select</span>
          <div className="w-[1px] h-4 bg-white/20"></div>
          <span className={toolMode === 'pan' ? "text-white font-semibold" : ""}>H:Pan</span>
          <div className="w-[1px] h-4 bg-white/20"></div>
          <span>DEL:Remove</span>
        </div>
      </motion.div>

      {/* Floating Node Palette with Distinct Shapes for Each Archetype */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className={cn(
          "absolute top-6 flex flex-col items-end gap-2.5 z-20 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar p-2 -mr-2 nowheel nopan nodrag transition-all duration-300",
          activeNode ? "right-[404px] max-md:hidden" : "right-6"
        )}
      >
        {Object.entries(NODE_CONFIG).map(([type, item]) => {
          const Icon = item.icon;
          return (
            <button
              key={type}
              onClick={() => addNode(type as keyof typeof NODE_CONFIG)}
              className={cn(
                "group flex items-center p-2 rounded-xl border bg-[#1a1a1a]/90 backdrop-blur-xl shadow-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden whitespace-nowrap shrink-0",
                "w-[52px] hover:w-[250px]",
                item.bg, item.border, item.hoverBorder
              )}
              title={item.desc}
            >
              {/* Distinctive mini shape badge reflecting the node's geometry */}
              <div className={cn(
                "w-8 h-8 shrink-0 bg-black/60 border flex items-center justify-center font-mono text-[9px] font-bold transition-transform group-hover:scale-105",
                item.border,
                item.color,
                item.paletteShape
              )}>
                <div className={type === 'condition' ? '-rotate-45' : ''}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 text-left">
                <div className={cn("text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5", item.color)}>
                  <span>{item.title}</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/50 border border-white/10 opacity-70">
                    {item.tag}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[170px]">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Node Settings Editor Sidebar (Sliding strictly from the RIGHT, persists until cross button is clicked) */}
      <AnimatePresence>
        {activeNode && (
          <motion.div
            key="node-settings-editor"
            initial={{ x: 450, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 450, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            onWheel={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 bottom-4 w-[380px] max-w-[calc(100vw-32px)] bg-[#16181d]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-30 overflow-hidden nowheel nopan nodrag"
          >
            <div className="flex flex-col h-full w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border font-mono text-[10px] font-bold", NODE_CONFIG[activeNode.data.nodeType]?.bg, NODE_CONFIG[activeNode.data.nodeType]?.border, NODE_CONFIG[activeNode.data.nodeType]?.color)}>
                    {NODE_CONFIG[activeNode.data.nodeType]?.tag}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-white text-sm">Node Settings</h3>
                    <p className="text-[10px] text-gray-400 font-mono">{NODE_CONFIG[activeNode.data.nodeType]?.title}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveSettingsNodeId(null)} 
                  className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors font-mono text-base leading-none active:scale-95"
                  title="Close Settings (×)"
                >
                  ×
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">Node Title</label>
                  <input 
                    type="text" 
                    value={activeNode.data.title}
                    onChange={(e) => onNodeDataChange(activeNode.id, { title: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 transition-all"
                  />
                </div>
                
                {/* Node Type Switcher */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">Node Archetype</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Object.entries(NODE_CONFIG).map(([type, cfg]) => {
                      const Icon = cfg.icon;
                      const isSelected = activeNode.data.nodeType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => onNodeDataChange(activeNode.id, { nodeType: type as keyof typeof NODE_CONFIG })}
                          className={cn(
                            "py-2 px-1 rounded-lg text-[10px] font-mono border transition-all flex flex-col items-center justify-center gap-1",
                            isSelected 
                              ? cn(cfg.bg, cfg.border, cfg.color, "shadow-inner font-bold ring-1 ring-white/20") 
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                          )}
                          title={cfg.desc}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{cfg.tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ROLE-SPECIFIC CONTROLS */}

                {/* 1. SYSTEM ROLE CONTROLS */}
                {activeNode.data.nodeType === 'system' && (
                  <div className="space-y-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
                    <label className="text-xs font-mono font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-blue-400" />
                      Persona Presets
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {SYSTEM_PERSONAS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => onNodeDataChange(activeNode.id, { systemPersona: p.id, description: p.desc })}
                          className={cn(
                            "text-left p-2 rounded-lg border text-xs transition-all",
                            activeNode.data.systemPersona === p.id 
                              ? "bg-blue-500/20 border-blue-400/60 text-white font-medium shadow-sm" 
                              : "bg-black/30 border-white/5 text-gray-300 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <div className="font-semibold text-blue-300">{p.name}</div>
                          <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. DATA ROLE CONTROLS */}
                {activeNode.data.nodeType === 'data' && (
                  <div className="space-y-2 p-3 bg-purple-500/5 rounded-xl border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-purple-400" />
                        Data Payload
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onNodeDataChange(activeNode.id, { dataMode: 'json' })}
                          className={cn("px-2 py-0.5 rounded text-[10px] font-mono", activeNode.data.dataMode !== 'kv' ? "bg-purple-500/30 text-purple-200 border border-purple-400/40" : "text-gray-400")}
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => onNodeDataChange(activeNode.id, { dataMode: 'kv' })}
                          className={cn("px-2 py-0.5 rounded text-[10px] font-mono", activeNode.data.dataMode === 'kv' ? "bg-purple-500/30 text-purple-200 border border-purple-400/40" : "text-gray-400")}
                        >
                          KV
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      {DATA_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => onNodeDataChange(activeNode.id, { dataPayload: preset.data, description: preset.name })}
                          className="px-2 py-1 bg-black/40 hover:bg-purple-500/20 text-[10px] font-mono text-purple-300 rounded border border-purple-500/30 transition-colors"
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={activeNode.data.dataPayload || activeNode.data.description}
                      onChange={(e) => onNodeDataChange(activeNode.id, { dataPayload: e.target.value })}
                      rows={6}
                      className="w-full bg-black/60 border border-purple-500/20 rounded-lg p-2.5 font-mono text-xs text-purple-200 focus:outline-none focus:border-purple-400 custom-scrollbar leading-relaxed"
                      placeholder="Enter JSON or key-values..."
                    />
                  </div>
                )}

                {/* 3. BRANCH CONDITION CONTROLS */}
                {activeNode.data.nodeType === 'condition' && (
                  <div className="space-y-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <label className="text-xs font-mono font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <GitFork className="w-3.5 h-3.5 text-amber-400" />
                      Branch Routing Rule
                    </label>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono text-gray-400">Condition Type</span>
                      <select
                        value={activeNode.data.conditionRule || 'contains'}
                        onChange={(e) => onNodeDataChange(activeNode.id, { conditionRule: e.target.value as any })}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      >
                        <option value="contains">Contains String</option>
                        <option value="not_contains">Does Not Contain</option>
                        <option value="length_gt">Length Greater Than</option>
                        <option value="regex">Matches Regex Pattern</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono text-gray-400">Target Match Value</span>
                      <input
                        type="text"
                        value={activeNode.data.conditionValue || ''}
                        onChange={(e) => onNodeDataChange(activeNode.id, { conditionValue: e.target.value })}
                        placeholder="e.g. success or 200"
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    <div className="text-[10px] font-mono text-gray-400 bg-black/40 p-2 rounded border border-white/5 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>Upper Right Handle connects to TRUE branch</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                        <span>Lower Right Handle connects to FALSE branch</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. CODE SCRIPT CONTROLS */}
                {activeNode.data.nodeType === 'code' && (
                  <div className="space-y-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                    <label className="text-xs font-mono font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-rose-400" />
                      JavaScript Logic
                    </label>

                    <div className="flex gap-1 flex-wrap">
                      {CODE_TEMPLATES.map(tmpl => (
                        <button
                          key={tmpl.id}
                          onClick={() => onNodeDataChange(activeNode.id, { codeScript: tmpl.code, description: tmpl.name })}
                          className="px-2 py-1 bg-black/40 hover:bg-rose-500/20 text-[10px] font-mono text-rose-300 rounded border border-rose-500/30 transition-colors"
                        >
                          + {tmpl.name}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={activeNode.data.codeScript || ''}
                      onChange={(e) => onNodeDataChange(activeNode.id, { codeScript: e.target.value })}
                      rows={6}
                      className="w-full bg-black/70 border border-rose-500/20 rounded-lg p-2.5 font-mono text-xs text-rose-200 focus:outline-none focus:border-rose-400 custom-scrollbar leading-relaxed"
                      placeholder="// Write JS here. 'input' contains upstream text.\nreturn input.toUpperCase();"
                    />
                  </div>
                )}

                {/* 5. MERGE AGGREGATOR CONTROLS */}
                {activeNode.data.nodeType === 'merge' && (
                  <div className="space-y-2 p-3 bg-teal-500/5 rounded-xl border border-teal-500/20">
                    <label className="text-xs font-mono font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-teal-400" />
                      Merge Strategy
                    </label>

                    <div className="grid grid-cols-1 gap-1.5">
                      {MERGE_STRATEGIES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => onNodeDataChange(activeNode.id, { mergeStrategy: s.id as any })}
                          className={cn(
                            "text-left p-2 rounded-lg border text-xs font-mono transition-all",
                            activeNode.data.mergeStrategy === s.id
                              ? "bg-teal-500/20 border-teal-400/60 text-white font-medium shadow-sm"
                              : "bg-black/30 border-white/5 text-gray-300 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. EVALUATION CONTROLS */}
                {activeNode.data.nodeType === 'evaluation' && (
                  <div className="space-y-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                    <label className="text-xs font-mono font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Evaluation Rubric
                    </label>

                    <div className="grid grid-cols-1 gap-1.5">
                      {EVAL_CRITERIA.map(c => (
                        <button
                          key={c.id}
                          onClick={() => onNodeDataChange(activeNode.id, { evalCriteria: c.id })}
                          className={cn(
                            "text-left p-2 rounded-lg border text-xs font-mono transition-all",
                            activeNode.data.evalCriteria === c.id
                              ? "bg-indigo-500/20 border-indigo-400/60 text-white font-medium shadow-sm"
                              : "bg-black/30 border-white/5 text-gray-300 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Model Selection (For Prompt, System, Evaluation, Merge) */}
                {['prompt', 'system', 'evaluation', 'merge'].includes(activeNode.data.nodeType) && (
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">AI Model</label>
                    <div className="space-y-2">
                      <CustomSelect 
                        value={activeNode.data.agentId}
                        options={AI_AGENTS}
                        onChange={(agentId) => {
                          const newAgent = AI_AGENTS.find(a => a.id === agentId)!;
                          onNodeDataChange(activeNode.id, { agentId: newAgent.id, modelId: newAgent.models[0].id });
                        }}
                        renderValue={(agent) => (
                          <>
                            <AgentIcon agent={agent} className="w-3.5 h-3.5" badgeClassName="w-5 h-5" />
                            <span>{agent.name}</span>
                          </>
                        )}
                        renderOption={(agent) => (
                          <>
                            <AgentIcon agent={agent} className="w-3.5 h-3.5" badgeClassName="w-5 h-5" />
                            <span>{agent.name}</span>
                          </>
                        )}
                      />
                      
                      <CustomSelect 
                        value={activeNode.data.modelId}
                        options={(AI_AGENTS.find(a => a.id === activeNode.data.agentId) || AI_AGENTS[0]).models}
                        onChange={(modelId) => onNodeDataChange(activeNode.id, { modelId })}
                        renderValue={(model) => {
                          const currentAgent = AI_AGENTS.find(a => a.id === activeNode.data.agentId) || AI_AGENTS[0];
                          return (
                            <>
                              <AgentIcon agent={currentAgent} model={model?.id} className="w-3 h-3" badgeClassName="w-4 h-4" />
                              <span className="font-mono text-xs">{model?.name}</span>
                            </>
                          );
                        }}
                        renderOption={(model) => {
                          const currentAgent = AI_AGENTS.find(a => a.id === activeNode.data.agentId) || AI_AGENTS[0];
                          return (
                            <>
                              <AgentIcon agent={currentAgent} model={model.id} className="w-3 h-3" badgeClassName="w-4 h-4" />
                              <span className="font-mono text-xs">{model.name}</span>
                            </>
                          );
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Description / Prompt Context */}
                <div className="space-y-2 flex flex-col">
                  <label className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
                    {activeNode.data.nodeType === 'system' ? 'Persona Rules' : 
                     activeNode.data.nodeType === 'output' ? 'Terminal Label / Note' :
                     activeNode.data.nodeType === 'code' ? 'Function Description' :
                     activeNode.data.nodeType === 'data' ? 'Dataset Note' :
                     'Prompt Context / Template'}
                  </label>
                  <textarea 
                    value={activeNode.data.description}
                    onChange={(e) => onNodeDataChange(activeNode.id, { description: e.target.value })}
                    className="w-full min-h-[140px] bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 transition-all resize-y custom-scrollbar font-mono text-xs leading-relaxed"
                    placeholder="Enter instructions, parameters or context for this node..."
                  />
                </div>
                
                <button 
                  onClick={async () => {
                    onNodeDataChange(activeNode.id, { status: 'running', output: undefined });
                    try {
                      const output = await testPrompt(activeNode.data.modelId, '', activeNode.data.description || activeNode.data.title);
                      onNodeDataChange(activeNode.id, { status: 'success', output });
                    } catch (err: any) {
                      onNodeDataChange(activeNode.id, { status: 'error', output: err.message || 'Execution failed' });
                    }
                  }}
                  className="w-full py-3 bg-white text-black rounded-xl font-semibold text-xs uppercase tracking-wider flex items-center justify-center hover:bg-gray-200 transition-colors shadow-lg shrink-0 mt-4 active:scale-[0.98]"
                >
                  Test Single Node
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BranchingChat() {
  return (
    <PageTransition>
      <div className="w-full p-4 sm:p-6 flex flex-col h-[calc(100vh-80px)]">
        <ReactFlowProvider>
          <FlowEditor />
        </ReactFlowProvider>
      </div>
    </PageTransition>
  );
}
