import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, RefreshCcw, FileText, Sparkles, Terminal, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { RefinementInput } from '../components/ui/RefinementInput';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { refinePrompt } from '../lib/api';

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
  const [promptText, setPromptText] = useState<string>(location.state?.promptText || '');
  const idea = location.state?.idea as string | undefined;

  const [chatHistory, setChatHistory] = useState([
    { role: 'user', content: idea },
    { role: 'ai', content: "Here is the standalone prompt covering your requirements. You can hand this to an AI coding agent without it trying to rebuild things that already exist." }
  ]);
  const [isRefining, setIsRefining] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);

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

  const chatPaneContent = (
    <>
      {/* Header */}
      <div className="flex-none p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <Terminal className="w-5 h-5 text-copper-500" />
          <span>Interactive prompt refinement</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSwapped(!isSwapped)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            title="Swap Panels"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Swap
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-10" data-lenis-prevent="true">
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
                    {idx === 1 ? 'Synthesized your prompt' : 'Refined your prompt'}
                  </div>
                  <div className="text-[15.5px] leading-relaxed text-gray-300">
                    <TypewriterText text={msg.content || ""} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        ))}
        
        {/* Loading State */}
        {isRefining && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="flex flex-col gap-4 max-w-[95%]">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-copper-500 animate-pulse" />
                Thinking...
              </div>
              <div className="text-[15.5px] leading-relaxed text-gray-300 flex items-center gap-1.5 h-6">
                <motion.div className="w-2 h-2 bg-copper-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.div className="w-2 h-2 bg-copper-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                <motion.div className="w-2 h-2 bg-copper-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Spacer for bottom input */}
        <div className="h-32"></div>
      </div>

      {/* Bottom Chat Input */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
        <RefinementInput 
          onSubmit={async (text) => {
            setChatHistory(prev => [...prev, { role: 'user', content: text }]);
            setIsRefining(true);
            try {
              const { updatedMarkdown, summary } = await refinePrompt(promptText, text);
              setPromptText(updatedMarkdown);
              setChatHistory(prev => [...prev, { role: 'ai', content: summary }]);
            } catch (err) {
              console.error(err);
              setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error while updating the document." }]);
            } finally {
              setIsRefining(false);
            }
          }}
        />
      </div>
    </>
  );

  const docPaneContent = (
    <>
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
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative" data-lenis-prevent="true">
        {isRefining && (
          <div className="absolute inset-0 bg-[#161616]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 transition-all duration-300">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-copper-500/20 border-t-copper-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-copper-500 animate-pulse" />
              </div>
            </div>
            <div className="mt-4 text-copper-500 font-medium animate-pulse">Applying your refinements...</div>
          </div>
        )}
        <div className={`max-w-4xl mx-auto prose prose-invert prose-copper prose-p:leading-relaxed prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-headings:font-display transition-opacity duration-300 ${isRefining ? 'opacity-30' : 'opacity-100'}`}>
          <ReactMarkdown>{promptText}</ReactMarkdown>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] text-white font-sans selection:bg-copper-500/30 overflow-hidden">
      
      {/* Split Pane Workspace */}
      <PanelGroup orientation="horizontal" className="w-full h-full">
        
        {/* LEFT PANE */}
        <Panel id="left-panel" defaultSize={45} minSize={25} className="relative overflow-hidden bg-[#0a0a0a]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={isSwapped ? "doc" : "chat"}
              initial={{ x: "100%", scale: 0.95, opacity: 0, filter: "blur(4px)" }}
              animate={{ x: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: "100%", scale: 0.95, opacity: 0, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className={`absolute inset-0 flex flex-col w-full h-full ${isSwapped ? 'bg-[#161616]' : 'bg-[#0a0a0a]'}`}
            >
              {isSwapped ? docPaneContent : chatPaneContent}
            </motion.div>
          </AnimatePresence>
        </Panel>

        {/* RESIZER HANDLE */}
        <PanelResizeHandle className="w-2 bg-[#0a0a0a] border-x border-white/5 flex items-center justify-center hover:bg-copper-500/20 active:bg-copper-500/40 transition-colors cursor-col-resize group z-10 relative">
          <div className="w-1 h-12 bg-white/10 group-hover:bg-copper-500 rounded-full transition-colors" />
        </PanelResizeHandle>

        {/* RIGHT PANE */}
        <Panel id="right-panel" defaultSize={55} minSize={30} className="relative overflow-hidden bg-[#161616]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={isSwapped ? "chat" : "doc"}
              initial={{ x: "-100%", scale: 0.95, opacity: 0, filter: "blur(4px)" }}
              animate={{ x: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: "-100%", scale: 0.95, opacity: 0, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className={`absolute inset-0 flex flex-col w-full h-full ${isSwapped ? 'bg-[#0a0a0a]' : 'bg-[#161616]'}`}
            >
              {isSwapped ? chatPaneContent : docPaneContent}
            </motion.div>
          </AnimatePresence>
        </Panel>

      </PanelGroup>
    </div>
  );
}
