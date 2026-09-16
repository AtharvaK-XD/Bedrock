import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RefinementInput } from '../components/ui/RefinementInput';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import PixelCard from '../components/ui/PixelCard';
import { refinePrompt } from '../lib/api';
import { PageTransition } from '../components/layout/PageTransition';

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
        <p>No prompt found. <button onClick={() => navigate('/')} className="text-copper-400 hover:text-copper-300 underline ml-1 transition-colors">Start over</button></p>
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
          <span className="w-1.5 h-1.5 rounded-full bg-copper-400"></span>
          <span>Interactive prompt refinement</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSwapped(!isSwapped)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 border border-white/5"
          >
            Swap Panels
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 border border-white/5"
          >
            Start Over
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
                  <div className="flex items-center gap-2 text-xs font-mono text-copper-400 font-semibold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-copper-400" />
                    {idx === 1 ? 'Prompt Synthesized' : 'Prompt Refined'}
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
              <div className="flex items-center gap-2 text-xs font-mono text-copper-400">
                <span className="w-1.5 h-1.5 rounded-full bg-copper-400 animate-pulse" />
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
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* Document Header */}
      <div className="flex-none p-4 border-b border-white/5 bg-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-display font-medium text-white text-[15px]">
            Bedrock App Prompt <span className="font-mono text-xs text-gray-500 ml-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">MD</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleCopy} 
            className="px-3 py-1.5 bg-[#222] border border-white/10 hover:bg-white/10 transition-colors rounded-lg text-xs font-semibold text-gray-200 uppercase tracking-wider"
          >
            Copy
          </button>
          <button 
            onClick={handleDownload} 
            className="px-3 py-1.5 bg-[#222] border border-white/10 hover:bg-white/10 transition-colors rounded-lg text-xs font-semibold text-gray-200 uppercase tracking-wider"
          >
            Download
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative" data-lenis-prevent="true">
        <div className={`max-w-4xl mx-auto prose prose-invert prose-copper prose-p:leading-relaxed prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-headings:font-display transition-opacity duration-300 ${isRefining ? 'opacity-30' : 'opacity-100'}`}>
          <ReactMarkdown>{promptText}</ReactMarkdown>
        </div>
      </div>

      {/* Full Output Panel Pixel Animation Overlay */}
      {isRefining && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0a0a]">
          <PixelCard
            active={true}
            variant="copper"
            gap={10}
            speed={35}
            className="w-full h-full !rounded-none !border-0 !bg-[#0a0a0a] flex flex-col items-center justify-center relative"
          >
            <div className="relative z-10 flex flex-col items-center justify-center text-center p-8 bg-black/60 backdrop-blur-xl rounded-3xl border border-white/10 max-w-sm w-full mx-4 shadow-2xl">
              <div className="w-12 h-12 border-2 border-copper-500/30 border-t-copper-400 rounded-full animate-spin"></div>
              <div className="mt-5 text-white font-display font-medium text-lg tracking-tight">
                Applying Refinements
              </div>
              <div className="mt-2 text-copper-400 font-mono text-xs uppercase tracking-widest animate-pulse">
                Synthesizing prompt changes...
              </div>
            </div>
          </PixelCard>
        </div>
      )}
    </div>
  );

  return (
    <PageTransition className="flex flex-col h-[calc(100vh-80px)] text-white font-sans selection:bg-copper-500/30 overflow-hidden">
      
      {/* Split Pane Workspace */}
      <PanelGroup orientation="horizontal" className="w-full h-full">
        
        {/* LEFT PANE */}
        <Panel id="left-panel" defaultSize={45} minSize={25} className="relative overflow-hidden bg-[#0a0a0a]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={isSwapped ? "doc" : "chat"}
              initial={{ x: "100%", scale: 0.95, opacity: 0 }}
              animate={{ x: 0, scale: 1, opacity: 1 }}
              exit={{ x: "100%", scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
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
              initial={{ x: "-100%", scale: 0.95, opacity: 0 }}
              animate={{ x: 0, scale: 1, opacity: 1 }}
              exit={{ x: "-100%", scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className={`absolute inset-0 flex flex-col w-full h-full ${isSwapped ? 'bg-[#0a0a0a]' : 'bg-[#161616]'}`}
            >
              {isSwapped ? chatPaneContent : docPaneContent}
            </motion.div>
          </AnimatePresence>
        </Panel>

      </PanelGroup>
    </PageTransition>
  );
}
