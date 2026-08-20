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
  Position,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { Bot, User, Cpu, SendHorizontal } from 'lucide-react';

// Custom Node component
const ChatNode = ({ data, selected }: any) => {
  const isSystem = data.role === 'system';
  const isUser = data.role === 'user';
  const isAssistant = data.role === 'assistant';

  return (
    <div className={cn(
      "relative p-5 rounded-3xl border w-[340px] shadow-2xl backdrop-blur-xl transition-all duration-300",
      isSystem ? 'bg-gradient-to-b from-purple-500/10 to-purple-900/30 border-purple-500/40' : 
      isUser ? 'bg-gradient-to-b from-blue-500/10 to-blue-900/30 border-blue-500/40' : 
      'bg-gradient-to-b from-teal-500/10 to-teal-900/30 border-teal-500/40',
      selected ? 'ring-2 ring-white/60 scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'hover:border-white/40',
      "shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
    )}>
      {!isSystem && (
        <Handle 
          type="target" 
          position={Position.Top} 
          className="w-3.5 h-3.5 bg-[#1a1a1a] border-2 border-white/60 rounded-full transition-transform hover:scale-125" 
        />
      )}
      
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shadow-inner",
          isSystem ? 'bg-purple-500/20 text-purple-300' : 
          isUser ? 'bg-blue-500/20 text-blue-300' : 'bg-teal-500/20 text-teal-300'
        )}>
          {isSystem && <Cpu size={16} />}
          {isUser && <User size={16} />}
          {isAssistant && <Bot size={16} />}
        </div>
        <div className="font-display font-bold text-sm tracking-wide text-gray-200 capitalize">
          {data.role}
        </div>
      </div>
      
      <div className="text-gray-100 text-[15px] whitespace-pre-wrap leading-relaxed px-1">
        {data.content}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3.5 h-3.5 bg-[#1a1a1a] border-2 border-white/60 rounded-full transition-transform hover:scale-125" 
      />
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
            <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.08)" gap={20} size={2} />
            <Controls className="bg-[#222] border-white/10 fill-white" showInteractive={false} />
          </ReactFlow>

          {/* Floating Input Panel */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-20">
             <div className="bg-white/5 p-[1px] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
               <div className="bg-[#111]/90 rounded-full p-2 flex items-center gap-3 pr-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={selectedNodeId ? "Branch from selected message..." : "Select a node to branch from, or type to continue..."}
                    className="flex-1 bg-transparent text-white px-6 py-3 text-[15px] placeholder:text-gray-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addBranch();
                    }}
                  />
                  <button 
                    onClick={addBranch}
                    disabled={!inputText.trim()}
                    className="bg-copper-500 hover:bg-copper-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-lg shadow-copper-500/20"
                  >
                    <SendHorizontal size={20} className={inputText.trim() ? "translate-x-[-1px]" : ""} />
                  </button>
               </div>
             </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
