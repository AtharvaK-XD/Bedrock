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
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { Plus, Hand, MousePointer2, Trash2 } from 'lucide-react';
import { ExpandableChatbox } from '../components/ui/ExpandableChatbox';
import { motion } from 'framer-motion';

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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
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
const GenericNode = ({ data, selected }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative p-4 rounded-xl border w-[260px] bg-[#1a1a1a]/40 backdrop-blur-xl transition-colors duration-200",
        selected ? 'border-copper-500 shadow-[0_0_30px_rgba(255,165,0,0.2)]' : 'border-white/10 hover:border-white/30',
        "shadow-2xl"
      )}
    >
      {/* 4 Handles for loose connection mode */}
      <Handle type="source" id="top" position={Position.Top} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-copper-400" />
      <Handle type="source" id="right" position={Position.Right} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-copper-400" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-copper-400" />
      <Handle type="source" id="left" position={Position.Left} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-copper-400" />

      <input
        className="nodrag bg-transparent w-full font-display font-medium text-sm text-gray-100 mb-2 focus:outline-none focus:bg-white/5 rounded px-1.5 py-0.5 -mx-1.5 transition-colors group-[.is-pan-mode]/flow:pointer-events-none"
        defaultValue={data.title}
        placeholder="Node Title"
      />
      <textarea
        className="nodrag bg-transparent w-full text-gray-400 text-[13px] leading-relaxed resize-none focus:outline-none focus:bg-white/5 rounded px-1.5 py-1 -mx-1.5 min-h-[60px] transition-colors group-[.is-pan-mode]/flow:pointer-events-none"
        defaultValue={data.content}
        placeholder="Enter details here..."
      />
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
    data: { title: 'Start Node', content: 'You can drag to connect this node from any side.' },
  },
];
const initialEdges: Edge[] = [];

function FlowEditor() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [toolMode, setToolMode] = useState<'pan' | 'select'>('pan');

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key.toLowerCase() === 'h') {
        setToolMode('pan');
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'genericNode',
      position: { x: 300 + Math.random() * 50, y: 200 + Math.random() * 50 },
      data: { title: 'New Node', content: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
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

      {/* Chatbox (Center) */}
      <motion.div
        initial={{ y: 50, x: "-50%", opacity: 0 }}
        animate={{ y: 0, x: "-50%", opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
        className="absolute bottom-6 left-1/2 z-10 w-[90%] max-w-2xl"
      >
        <ExpandableChatbox
          className="w-full"
          onSubmit={(text) => {
            const newNode: Node = {
              id: `node-${Date.now()}`,
              type: 'genericNode',
              position: { x: 300 + Math.random() * 50, y: 200 + Math.random() * 50 },
              data: { title: 'AI Response', content: `You asked: "${text}"\n\n(This is a placeholder response node)` },
            };
            setNodes((nds) => [...nds, newNode].map(n => ({ ...n, selected: false })));
          }}
        />
      </motion.div>

      {/* Top Left Toolbar */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="absolute top-6 left-6 z-10 flex items-center gap-3"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={addNode}
          className="flex items-center gap-2 bg-copper-500 hover:bg-copper-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-black/20"
        >
          <Plus size={16} />
          <span>Add Node</span>
        </motion.button>

        <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a]/40 backdrop-blur-2xl border border-white/10 rounded-xl text-xs font-medium text-gray-400 shadow-lg shadow-black/20">
          <span className={toolMode === 'select' ? "text-white drop-shadow-md" : ""}>Press V to Select</span>
          <div className="w-1 h-1 rounded-full bg-white/20"></div>
          <span className={toolMode === 'pan' ? "text-white drop-shadow-md" : ""}>Press H to Pan</span>
        </div>
      </motion.div>
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
