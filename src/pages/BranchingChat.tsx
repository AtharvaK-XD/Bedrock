import { useCallback, useState } from 'react';
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
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';

// Custom Node component
const ChatNode = ({ data, selected }: any) => {
  return (
    <div className={cn(
      "p-5 rounded-2xl border w-[320px] shadow-2xl backdrop-blur-md transition-all",
      data.role === 'system' ? 'bg-purple-900/30 border-purple-500/50' : 
      data.role === 'user' ? 'bg-blue-900/30 border-blue-500/50' : 
      'bg-teal-900/30 border-teal-500/50',
      selected ? 'ring-2 ring-white/50 scale-[1.02]' : 'hover:border-white/30'
    )}>
      {data.role !== 'system' && (
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-white border-0" />
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          "w-2 h-2 rounded-full",
          data.role === 'system' ? 'bg-purple-400' : 
          data.role === 'user' ? 'bg-blue-400' : 'bg-teal-400'
        )} />
        <div className="font-bold text-xs uppercase tracking-wider text-gray-300">{data.role}</div>
      </div>
      <div className="text-white text-sm whitespace-pre-wrap leading-relaxed">{data.content}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-white border-0" />
    </div>
  );
};

const nodeTypes = { chatNode: ChatNode };

const initialNodes: Node[] = [
  {
    id: 'system-1',
    type: 'chatNode',
    position: { x: 250, y: 50 },
    data: { role: 'system', content: 'You are an advanced Prompt Engineering assistant. Analyze the user requests carefully.' },
  },
];

const initialEdges: Edge[] = [];

export default function BranchingChat() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [inputText, setInputText] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
  };

  const addBranch = () => {
    if (!inputText.trim()) return;

    let parentX = 250;
    let parentY = 50;

    let parentId = selectedNodeId;
    
    // If no node is selected, attach to the latest leaf node, or just attach to system-1 if none
    if (!parentId && nodes.length > 0) {
      parentId = nodes[nodes.length - 1].id;
    }

    if (parentId) {
      const parentNode = nodes.find(n => n.id === parentId);
      if (parentNode) {
        parentX = parentNode.position.x;
        parentY = parentNode.position.y;
      }
    }

    // Determine siblings of this new node (nodes that share the same parent)
    const siblings = edges.filter(e => e.source === parentId);
    
    // Layout logic: space out branches horizontally
    const offsetX = (siblings.length * 360) - (siblings.length > 0 ? 180 : 0);
    
    const newNodeId = `user-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: 'chatNode',
      position: { x: parentX + offsetX, y: parentY + 200 },
      data: { role: 'user', content: inputText },
    };

    setNodes((nds) => [...nds, newNode].map(n => ({ ...n, selected: false })));
    
    if (parentId) {
      setEdges((eds) => [...eds, { 
        id: `e${parentId}-${newNodeId}`, 
        source: parentId, 
        target: newNodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#fff', strokeWidth: 2 }
      }]);
    }

    setInputText('');
    setSelectedNodeId(newNodeId);

    // Simulate AI response
    setTimeout(() => {
      const aiNodeId = `ai-${Date.now()}`;
      const aiNode: Node = {
        id: aiNodeId,
        type: 'chatNode',
        position: { x: newNode.position.x, y: newNode.position.y + 200 },
        data: { role: 'assistant', content: `This is a simulated AI response to: "${inputText}". In a real app, this would hit the OpenAI API.` },
      };
      setNodes((nds) => [...nds, aiNode].map(n => ({
        ...n,
        selected: n.id === aiNodeId
      })));
      setEdges((eds) => [...eds, { 
        id: `e${newNodeId}-${aiNodeId}`, 
        source: newNodeId, 
        target: aiNodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#14b8a6', strokeWidth: 2 }
      }]);
      setSelectedNodeId(aiNodeId);
    }, 1500);
  };

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-6 lg:py-10 flex flex-col h-[calc(100vh-80px)]">
        <div className="text-center mb-6 z-10 shrink-0">
          <h1 className="text-5xl font-editorial font-bold text-white mb-2 tracking-tight">Branching Chat.</h1>
          <p className="text-gray-400 text-lg">Select a message node and click Send to branch off from that timeline.</p>
        </div>
        
        <div className="flex-1 bg-[#1a1a1a]/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden relative shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            fitView
            minZoom={0.2}
            className="bg-transparent"
          >
            <Background color="#ffffff20" gap={24} size={2} />
            <Controls className="bg-[#222] border-white/10 fill-white" showInteractive={false} />
          </ReactFlow>

          {/* Floating Input Panel */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-20">
             <div className="bg-[#111]/90 backdrop-blur-xl p-2.5 rounded-2xl border border-white/20 shadow-2xl flex gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={selectedNodeId ? "Branch from selected message..." : "Select a node to branch from, or type to continue from the latest..."}
                  className="flex-1 bg-transparent text-white px-4 py-2 text-lg placeholder:text-gray-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addBranch();
                  }}
                />
                <button 
                  onClick={addBranch}
                  disabled={!inputText.trim()}
                  className="bg-copper-500 hover:bg-copper-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-copper-500/20"
                >
                  Send
                </button>
             </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
