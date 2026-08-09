import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Download, RefreshCcw, FileText, Sparkles, Terminal, ChevronDown } from 'lucide-react';
import { RefinementInput } from '../components/ui/RefinementInput';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

const TypewriterText = ({ text }: { text: string }) => {
  const words = text.split(' ');
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
      className="inline"
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          variants={{
            hidden: { opacity: 0, filter: 'blur(4px)', y: 2 },
            visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.2, ease: 'easeOut' } }
          }}
          className="inline-block mr-[0.25em] align-top"
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const promptText = location.state?.promptText as string | undefined;
  const idea = location.state?.idea as string | undefined;

  const [chatHistory, setChatHistory] = useState([
    { role: 'user', content: idea },
    { role: 'ai', content: "Here is the standalone prompt covering your requirements. You can hand this to an AI coding agent without it trying to rebuild things that already exist." }
  ]);

  if (!promptText) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <p>No prompt found. <button onClick={() => navigate('/')} className="text-copper-500 hover:text-copper-600 underline ml-1 transition-colors">Start over</button></p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    alert('Copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([promptText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bedrock-prompt.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] text-white font-sans selection:bg-copper-500/30 overflow-hidden">
      
      {/* Split Pane Workspace */}
      <PanelGroup orientation="horizontal" className="w-full h-full">
        
        {/* LEFT PANE: Chat & Refinement */}
        <Panel defaultSize={45} minSize={25} className="flex flex-col h-full bg-[#0a0a0a] relative">
          
          {/* Header */}
          <div className="flex-none p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Terminal className="w-5 h-5 text-copper-500" />
              <span>Interactive prompt refinement</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Start Over
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-10">
            {chatHistory.map((msg, idx) => (
              <div key={idx}>
                {msg.role === 'user' && msg.content && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                    <div className="bg-white/5 border border-white/10 text-gray-300 px-5 py-3.5 rounded-3xl rounded-tr-sm max-w-[85%] text-[15px] leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </motion.div>
                )}
                
                {msg.role === 'ai' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="flex flex-col gap-4 max-w-[95%]">
                      <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                        <Sparkles className="w-4 h-4 text-copper-500" />
                        Synthesized your prompt
                      </div>
                      <div className="text-[15.5px] leading-relaxed text-gray-300">
                        <TypewriterText text={msg.content || ""} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
            {/* Spacer for bottom input */}
            <div className="h-32"></div>
          </div>

          {/* Bottom Chat Input */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
            <RefinementInput 
              onSubmit={(text) => {
                setChatHistory(prev => [...prev, { role: 'user', content: text }]);
                setTimeout(() => {
                  setChatHistory(prev => [...prev, { role: 'ai', content: "I've noted that refinement. The document has been updated!" }]);
                }, 1000);
              }}
            />
          </div>

        </Panel>

        {/* RESIZER HANDLE */}
        <PanelResizeHandle className="w-2 bg-[#0a0a0a] border-x border-white/5 flex items-center justify-center hover:bg-copper-500/20 active:bg-copper-500/40 transition-colors cursor-col-resize group z-10">
          <div className="w-1 h-12 bg-white/10 group-hover:bg-copper-500 rounded-full transition-colors" />
        </PanelResizeHandle>

        {/* RIGHT PANE: Markdown Document Viewer */}
        <Panel defaultSize={55} minSize={30} className="flex flex-col h-full bg-[#161616]">
          
          {/* Document Header */}
          <div className="flex-none p-4 border-b border-white/5 bg-[#1a1a1a] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-300" />
              </div>
              <div className="font-medium text-white text-[15px]">
                Bedrock desktop app prompt <span className="text-gray-500 font-normal ml-1">MD</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={handleCopy} 
                className="flex items-center gap-2 px-3 py-1.5 bg-[#222] border border-white/10 hover:bg-white/10 transition-colors rounded-lg text-sm font-medium text-gray-200"
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button 
                onClick={handleDownload} 
                className="flex items-center gap-2 px-3 py-1.5 bg-[#222] border border-white/10 hover:bg-white/10 transition-colors rounded-lg text-sm font-medium text-gray-200"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto prose prose-invert prose-copper prose-p:leading-relaxed prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-headings:font-display">
              <ReactMarkdown>{promptText}</ReactMarkdown>
            </div>
          </div>
          
        </Panel>

      </PanelGroup>
    </div>
  );
}
