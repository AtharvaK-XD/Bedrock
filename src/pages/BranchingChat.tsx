import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { Plus, Hand, MousePointer2, Trash2 } from 'lucide-react';
import { ExpandableChatbox } from '../components/ui/ExpandableChatbox';

// Generic Node component with 4 handles
const GenericNode = ({ data, selected }: any) => {
  return (
    <div className={cn(
      "relative p-4 rounded-xl border w-[260px] bg-[#1a1a1a]/95 backdrop-blur-xl transition-all duration-200",
      selected ? 'border-copper-500 shadow-[0_0_20px_rgba(255,165,0,0.2)]' : 'border-white/10 hover:border-white/30',
      "shadow-xl"
    )}>
      {/* 4 Handles for loose connection mode */}
      <Handle type="source" id="top" position={Position.Top} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-white" />
      <Handle type="source" id="right" position={Position.Right} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-white" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-white" />
      <Handle type="source" id="left" position={Position.Left} className="w-3 h-3 bg-zinc-900 border-2 border-zinc-400 hover:scale-125 transition-transform hover:border-white" />
      
      <input 
        className="nodrag bg-transparent w-full font-display font-medium text-sm text-gray-100 mb-2 focus:outline-none focus:bg-white/5 rounded px-1.5 py-0.5 -mx-1.5 transition-colors" 
        defaultValue={data.title}
        placeholder="Node Title"
      />
      <textarea 
        className="nodrag bg-transparent w-full text-gray-400 text-[13px] leading-relaxed resize-none focus:outline-none focus:bg-white/5 rounded px-1.5 py-1 -mx-1.5 min-h-[60px] transition-colors" 
        defaultValue={data.content}
        placeholder="Enter details here..."
      />
    </div>
  );
};

const nodeTypes = { genericNode: GenericNode };

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
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#fff', strokeWidth: 2 } }, eds)),
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
    <div className="w-full h-full relative flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="flex-1 w-full bg-[#0a0a0a]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          panOnDrag={toolMode === 'pan'}
          selectionOnDrag={toolMode === 'select'}
          panOnScroll={true}
          fitView
          className="bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.08)" gap={20} size={2} />
          <Controls className="bg-[#222] border-white/10 fill-white" showInteractive={false} />
        </ReactFlow>
      </div>
      
      {/* Floating Toolbar & Chatbox */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4 w-[90%] max-w-2xl">
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
        
        <div className="bg-[#1a1a1a]/90 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-2">
          
          <button 
            onClick={addNode}
            className="flex items-center gap-2 bg-copper-500 hover:bg-copper-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Add Node</span>
          </button>
          
          <div className="w-px h-8 bg-white/10 mx-1"></div>
          
          <button 
            onClick={() => setToolMode('select')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
              toolMode === 'select' ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
            title="Select Mode (V)"
          >
            <MousePointer2 size={16} />
            <span className="hidden sm:inline">Select (V)</span>
          </button>
          
          <button 
            onClick={() => setToolMode('pan')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
              toolMode === 'pan' ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
            title="Pan Mode (H)"
          >
            <Hand size={16} />
            <span className="hidden sm:inline">Pan (H)</span>
          </button>

          <div className="w-px h-8 bg-white/10 mx-1"></div>
          
          <button 
            onClick={deleteSelected}
            className="flex items-center justify-center p-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            title="Delete Selected (Backspace/Del)"
          >
            <Trash2 size={18} />
          </button>

        </div>
      </div>
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
