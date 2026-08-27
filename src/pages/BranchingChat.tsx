import { useCallback, useState, useEffect } from 'react';
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
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { 
  Plus, Hand, MousePointer2, Trash2, Play, Settings, Bot, FileText, 
  CheckCircle2, AlertCircle, X, Database, GitBranch, Code, Merge, ListChecks 
} from 'lucide-react';
import { ExpandableChatbox } from '../components/ui/ExpandableChatbox';
import { motion, AnimatePresence } from 'framer-motion';
import { AI_AGENTS, AgentIcon } from '../components/ui/RichInput';

export const NODE_CONFIG = {
  system: { 
    title: 'System Persona', 
    desc: 'Sets base context & behavior', 
    icon: Settings, 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    hoverBorder: 'hover:border-blue-500/50' 
  },
  prompt: { 
    title: 'User Prompt', 
    desc: 'Main instruction or input', 
    icon: FileText, 
    color: 'text-copper-400', 
    bg: 'bg-copper-500/10',
    border: 'border-copper-500/20',
    hoverBorder: 'hover:border-copper-500/50' 
  },
  output: { 
    title: 'AI Output', 
    desc: 'Response validation & chaining', 
    icon: Bot, 
    color: 'text-green-400', 
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    hoverBorder: 'hover:border-green-500/50' 
  },
  data: { 
    title: 'Data Context', 
    desc: 'Inject variables or documents', 
    icon: Database, 
    color: 'text-purple-400', 
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    hoverBorder: 'hover:border-purple-500/50' 
  },
  condition: { 
    title: 'Condition / If', 
    desc: 'Route based on AI response', 
    icon: GitBranch, 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    hoverBorder: 'hover:border-yellow-500/50' 
  },
  code: { 
    title: 'Code Script', 
    desc: 'Execute custom logic', 
    icon: Code, 
    color: 'text-red-400', 
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    hoverBorder: 'hover:border-red-500/50' 
  },
  merge: { 
    title: 'Merge Nodes', 
    desc: 'Combine multiple inputs', 
    icon: Merge, 
    color: 'text-teal-400', 
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    hoverBorder: 'hover:border-teal-500/50' 
  },
  evaluation: { 
    title: 'Evaluation', 
    desc: 'Grade output quality', 
    icon: ListChecks, 
    color: 'text-indigo-400', 
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    hoverBorder: 'hover:border-indigo-500/50' 
  }
};

// Define custom node data type
export type PromptNodeData = {
  title: string;
  description: string;
  agentId: string;
  modelId: string;
  status: 'idle' | 'running' | 'success' | 'error';
  nodeType: keyof typeof NODE_CONFIG;
  output?: string;
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
            className="w-5 h-5 flex items-center justify-center bg-[#1a1a1a] border border-white/20 rounded-full text-gray-400 hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10 transition-colors shadow-lg"
            onClick={onEdgeClick}
            title="Delete Connection"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Generic Node component with 4 handles
const GenericNode = ({ id, data, selected }: { id: string, data: PromptNodeData, selected: boolean }) => {
  const { setNodes } = useReactFlow();
  
  const agent = AI_AGENTS.find(a => a.id === data.agentId) || AI_AGENTS[0];
  const model = agent.models.find(m => m.id === data.modelId) || agent.models[0];
  
  const config = NODE_CONFIG[data.nodeType] || NODE_CONFIG.prompt;

  const handleRun = () => {
    // Mock run logic
    setNodes(nodes => nodes.map(n => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, status: 'running' } };
      }
      return n;
    }));
    setTimeout(() => {
      setNodes(nodes => nodes.map(n => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, status: 'success', output: `Simulated ${config.title} execution for:\n` + (data.description || data.title) } };
        }
        return n;
      }));
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative flex flex-col rounded-xl border w-[280px] bg-[#1a1a1a]/90 backdrop-blur-xl transition-colors duration-200 shadow-2xl",
        selected ? 'border-copper-500 shadow-[0_0_30px_rgba(255,165,0,0.15)]' : 'border-white/10 hover:border-white/30'
      )}
    >
      {/* 4 Handles for loose connection mode, perfectly centered and transform-free */}
      <Handle type="source" id="top" position={Position.Top} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 transition-colors hover:border-copper-400 !transform-none" style={{ left: 'calc(50% - 6px)', top: '-6px' }} />
      <Handle type="source" id="right" position={Position.Right} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 transition-colors hover:border-copper-400 !transform-none" style={{ top: 'calc(50% - 6px)', right: '-6px' }} />
      <Handle type="source" id="bottom" position={Position.Bottom} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 transition-colors hover:border-copper-400 !transform-none" style={{ left: 'calc(50% - 6px)', bottom: '-6px' }} />
      <Handle type="source" id="left" position={Position.Left} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 transition-colors hover:border-copper-400 !transform-none" style={{ top: 'calc(50% - 6px)', left: '-6px' }} />

      {/* Node Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-b rounded-t-xl",
        config.bg, config.border
      )}>
        <div className="flex items-center gap-2">
           <config.icon className={cn("w-4 h-4", config.color)} />
           <span className="text-[11px] font-semibold tracking-wide uppercase text-white/70">
             {config.title}
           </span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded-md border border-white/5">
           <AgentIcon agent={agent} className="w-3 h-3 opacity-70" />
           <span className="text-[10px] font-medium text-gray-400 truncate max-w-[80px]">{model.name}</span>
        </div>
      </div>
      
      {/* Node Body */}
      <div className="p-3 flex flex-col gap-2">
        <div className="font-display font-medium text-[15px] text-white truncate">
          {data.title || "Untitled Node"}
        </div>
        <div className="text-[13px] text-gray-400 line-clamp-3 leading-relaxed min-h-[40px]">
          {data.description || <span className="italic opacity-50">No description provided...</span>}
        </div>
        
        {data.output && (
          <div className="mt-2 p-2 bg-white/5 rounded-lg border border-white/10 text-[12px] text-gray-300 max-h-[100px] overflow-y-auto custom-scrollbar">
            {data.output}
          </div>
        )}
      </div>
      
      {/* Node Footer */}
      <div className="px-3 py-2 border-t border-white/10 bg-black/40 flex items-center justify-between rounded-b-xl group-[.is-pan-mode]/flow:pointer-events-none">
        <div className="flex items-center gap-2">
          {data.status === 'running' && <div className="w-3 h-3 border-2 border-copper-500/30 border-t-copper-500 rounded-full animate-spin" />}
          {data.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
          {data.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
          {data.status === 'idle' && <div className="w-3 h-3 rounded-full bg-white/10" />}
          <span className="text-[11px] font-medium text-gray-500 capitalize">{data.status}</span>
        </div>
        
        <button 
          onClick={handleRun}
          disabled={data.status === 'running'}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium transition-colors nodrag disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          Run
        </button>
      </div>
    </motion.div>
  );
};

const nodeTypes = { genericNode: GenericNode };
const edgeTypes = { deletableEdge: DeletableEdge };

const initialNodes: Node[] = [
  {
    id: 'node-1',
    type: 'genericNode',
    position: { x: 250, y: 150 },
    data: { 
      title: 'Base Persona', 
      description: 'You are an expert React developer. Write concise, modern code.',
      agentId: 'chatgpt',
      modelId: 'gpt-4o',
      nodeType: 'system',
      status: 'idle'
    } as PromptNodeData,
  },
];
const initialEdges: Edge[] = [];

function FlowEditor() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [toolMode, setToolMode] = useState<'pan' | 'select'>('select');

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'deletableEdge', animated: true, style: { stroke: '#fff', strokeWidth: 2 } }, eds)),
    []
  );

  // Keyboard shortcuts for Hand (H) and Select (V) tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.key.toLowerCase() === 'h') {
        setToolMode('pan');
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        setNodes((nds) => nds.filter((node) => !node.selected));
        setEdges((eds) => eds.filter((edge) => !edge.selected));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addNode = (type: keyof typeof NODE_CONFIG = 'prompt') => {
    const config = NODE_CONFIG[type];
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'genericNode',
      position: { x: 300 + Math.random() * 50, y: 200 + Math.random() * 50 },
      data: { 
        title: `New ${config.title}`, 
        description: '',
        agentId: 'chatgpt',
        modelId: 'gpt-4o',
        nodeType: type,
        status: 'idle'
      } as PromptNodeData,
    };
    setNodes((nds) => [...nds.map(n => ({...n, selected: false})), { ...newNode, selected: true }]);
  };

  const selectedNode = nodes.find(n => n.selected);

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
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'deletableEdge' }}
          connectionMode={ConnectionMode.Loose}
          panOnDrag={toolMode === 'pan'}
          selectionOnDrag={toolMode === 'select'}
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
        className="absolute top-6 left-6 z-10 flex items-center gap-3"
      >
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a]/60 backdrop-blur-2xl border border-white/10 rounded-xl text-xs font-medium text-gray-400 shadow-lg shadow-black/20">
          <span className={toolMode === 'select' ? "text-white drop-shadow-md" : ""}>Press V to Select</span>
          <div className="w-1 h-1 rounded-full bg-white/20"></div>
          <span className={toolMode === 'pan' ? "text-white drop-shadow-md" : ""}>Press H to Pan</span>
          <div className="w-1 h-1 rounded-full bg-white/20"></div>
          <span>Backspace to Delete</span>
        </div>
      </motion.div>

      {/* Right UI Overlays */}
      <AnimatePresence mode="wait">
        {selectedNode ? (
          /* Node Settings Editor */
          <motion.div
            key="editor"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-4 right-4 bottom-4 w-80 bg-[#1a1a1a]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-20 overflow-hidden"
          >
            <div className="flex flex-col h-full w-80">
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                <h3 className="font-display font-semibold text-white">Node Settings</h3>
                <button onClick={() => setNodes(nds => nds.map(n => ({...n, selected: false})))} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Node Title</label>
                  <input 
                    type="text" 
                    value={selectedNode.data.title}
                    onChange={(e) => onNodeDataChange(selectedNode.id, { title: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 transition-all"
                  />
                </div>
                
                {/* Node Type */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Node Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
                      <button
                        key={type}
                        onClick={() => onNodeDataChange(selectedNode.id, { nodeType: type as keyof typeof NODE_CONFIG })}
                        className={cn(
                          "px-2 py-2 rounded-lg text-[11px] font-medium capitalize border transition-all flex items-center justify-center gap-1.5",
                          selectedNode.data.nodeType === type 
                            ? cn(cfg.bg, cfg.border, cfg.color, "shadow-inner") 
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                        )}
                        title={cfg.desc}
                      >
                        <cfg.icon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Model</label>
                  <div className="space-y-2">
                    <select 
                      value={selectedNode.data.agentId}
                      onChange={(e) => {
                        const newAgent = AI_AGENTS.find(a => a.id === e.target.value)!;
                        onNodeDataChange(selectedNode.id, { agentId: newAgent.id, modelId: newAgent.models[0].id });
                      }}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-copper-500/50"
                    >
                      {AI_AGENTS.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                    
                    <select 
                      value={selectedNode.data.modelId}
                      onChange={(e) => onNodeDataChange(selectedNode.id, { modelId: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-copper-500/50"
                    >
                      {(AI_AGENTS.find(a => a.id === selectedNode.data.agentId) || AI_AGENTS[0]).models.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Description / Prompt */}
                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prompt Context</label>
                  <textarea 
                    value={selectedNode.data.description}
                    onChange={(e) => onNodeDataChange(selectedNode.id, { description: e.target.value })}
                    className="w-full flex-1 min-h-[150px] bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 transition-all resize-none custom-scrollbar"
                    placeholder="Enter the prompt instructions or context for this node..."
                  />
                </div>
                
                <button 
                  onClick={() => {
                    const cfg = NODE_CONFIG[selectedNode.data.nodeType];
                    onNodeDataChange(selectedNode.id, { status: 'running', output: undefined });
                    setTimeout(() => {
                      onNodeDataChange(selectedNode.id, { 
                        status: 'success', 
                        output: `Simulated ${cfg.title} execution for: "${selectedNode.data.title}"\n\nBased on your prompt: ${selectedNode.data.description}` 
                      });
                    }, 2000);
                  }}
                  className="w-full py-3 bg-white text-black rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg shrink-0 mt-auto"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Execute Node
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Floating Node Palette */
          <motion.div
            key="palette"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-6 right-6 flex flex-col items-end gap-3 z-20 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar p-2 -mr-2"
          >
            {Object.entries(NODE_CONFIG).map(([type, item]) => (
              <button
                key={type}
                onClick={() => addNode(type as keyof typeof NODE_CONFIG)}
                className={cn(
                  "group flex items-center p-3 rounded-xl border bg-[#1a1a1a]/80 backdrop-blur-xl shadow-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden whitespace-nowrap shrink-0",
                  "w-[56px] hover:w-[260px]",
                  item.bg, item.border, item.hoverBorder
                )}
              >
                <div className={cn("p-2 rounded-lg shrink-0 bg-black/40", item.color)}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 text-left">
                  <div className={cn("text-sm font-semibold transition-colors", item.color)}>{item.title}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{item.desc}</div>
                </div>
              </button>
            ))}
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
