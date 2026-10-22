import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { RefinementInput } from '../components/ui/RefinementInput';
import { ArrowLeftRight, Code2, Download, Copy, Check, PanelLeftOpen, PanelLeftClose, HardDrive } from 'lucide-react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import PixelCard from '../components/ui/PixelCard';
import { EncryptedText } from '../components/ui/encrypted-text';
import { refinePrompt } from '../lib/api';
import { sanitizeRenderedPrompt } from '../lib/aiPrompts';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { openApiKeyModal } from '../lib/apiKeyEvents';
import { addPromptToHistory, getStoredGeneratorHistory, type HistoryPromptItem } from '../lib/generatorHistory';
import { recordExecutionTrace } from '../lib/telemetry';
import { isDesktopApp } from '../lib/platform';
import { ExportModal } from '../components/ui/ExportModal';
import { GeneratorHistorySidebar } from '../components/generator/GeneratorHistorySidebar';
import { saveRuleFileDirectly } from '../lib/fileExport';
import { EXPORT_TARGETS } from '../lib/exportGenerators';

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
  const isDesktop = isDesktopApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(() => {
    if (location.state?.historyId) return location.state.historyId;
    const history = getStoredGeneratorHistory();
    const latest = history.find(h => Boolean(h.promptText));
    return latest?.id || null;
  });

  const [currentIdea, setCurrentIdea] = useState<string>(() => {
    if (location.state?.idea) return location.state.idea;
    const history = getStoredGeneratorHistory();
    const latest = history.find(h => Boolean(h.promptText));
    return latest?.ideaText || latest?.title || 'Initial Project Request';
  });

  const [promptText, setPromptText] = useState<string>(() => {
    if (location.state?.promptText) {
      return sanitizeRenderedPrompt(location.state.promptText);
    }
    const history = getStoredGeneratorHistory();
    const latestWithPrompt = history.find(h => Boolean(h.promptText));
    if (latestWithPrompt?.promptText) {
      return sanitizeRenderedPrompt(latestWithPrompt.promptText);
    }
    return '';
  });

  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>(() => [
    {
      role: 'user',
      content: location.state?.idea || (getStoredGeneratorHistory().find(h => Boolean(h.promptText))?.ideaText) || 'Initial Project Request',
    },
    {
      role: 'ai',
      content: "Here is the standalone prompt covering your requirements. You can hand this to an AI coding agent without it trying to rebuild things that already exist.",
    },
  ]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bedrock_generator_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bedrock_generator_sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Sync state when location.state updates (e.g. navigating from Wizard)
  useEffect(() => {
    if (location.state?.promptText) {
      setPromptText(sanitizeRenderedPrompt(location.state.promptText));
      const incomingIdea = location.state.idea || 'Initial Project Request';
      setCurrentIdea(incomingIdea);
      setActiveHistoryId(location.state.historyId || null);
      setChatHistory([
        { role: 'user', content: incomingIdea },
        { role: 'ai', content: "Here is the standalone prompt covering your requirements. You can hand this to an AI coding agent without it trying to rebuild things that already exist." },
      ]);
    }
  }, [location.state]);

  const handleSelectPrompt = (prompt: HistoryPromptItem) => {
    if (prompt.promptText) {
      setPromptText(sanitizeRenderedPrompt(prompt.promptText));
      const ideaTitle = prompt.ideaText || prompt.title;
      setCurrentIdea(ideaTitle);
      setActiveHistoryId(prompt.id);
      setChatHistory([
        { role: 'user', content: ideaTitle },
        { role: 'ai', content: "Here is the standalone prompt covering your requirements. You can hand this to an AI coding agent without it trying to rebuild things that already exist." },
      ]);
    } else {
      navigate('/app/generator', {
        state: { idea: prompt.ideaText, targetType: prompt.targetType, id: prompt.id },
      });
    }
  };

  const handleNewPrompt = () => {
    navigate('/app/generator');
  };

  const [isRefining, setIsRefining] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [directSaveToast, setDirectSaveToast] = useState<string | null>(null);
  const [isSavingDirect, setIsSavingDirect] = useState(false);

  const handleQuickSaveCursorRules = async () => {
    if (!promptText) return;
    setIsSavingDirect(true);
    const target = EXPORT_TARGETS.find((t) => t.id === 'cursorrules') || EXPORT_TARGETS[0];
    const code = target.generate(promptText, currentIdea);
    const res = await saveRuleFileDirectly(target.filename, code);
    setIsSavingDirect(false);
    if (res.success) {
      setDirectSaveToast(`Saved ${target.filename}!`);
      setTimeout(() => setDirectSaveToast(null), 3500);
    }
  };

  if (!promptText) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <p>No prompt found. <button onClick={() => navigate('/')} className="text-copper-400 hover:text-copper-300 underline ml-1 transition-colors">Start over</button></p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(sanitizeRenderedPrompt(promptText));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const cleanContent = sanitizeRenderedPrompt(promptText);
    const blob = new Blob([cleanContent], { type: 'text/markdown' });
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
          {!isSwapped && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer mr-1 group shadow-sm"
              title={isSidebarCollapsed ? "Show previous prompts (History)" : "Hide history sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-copper-400 group-hover:scale-110 transition-transform" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-neutral-400 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-xs font-mono text-neutral-300">History</span>
            </button>
          )}
          <span>Interactive prompt refinement</span>
        </div>
        <button
          type="button"
          onClick={() => setIsSwapped(!isSwapped)}
          title="Swap Panels"
          aria-label="Swap Panels"
          className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 border border-white/5 flex items-center justify-center cursor-pointer"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
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
                  <div className="text-xs font-mono text-copper-400 font-semibold uppercase tracking-wider">
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
              <div className="text-xs font-mono text-copper-400 font-medium">
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
            const nextHistory = [...chatHistory, { role: 'user', content: text }];
            setChatHistory(nextHistory);
            setIsRefining(true);
            try {
              const { updatedMarkdown, summary } = await refinePrompt(promptText, text, nextHistory);
              const cleanMarkdown = sanitizeRenderedPrompt(updatedMarkdown);
              setPromptText(cleanMarkdown);
              setChatHistory(prev => [...prev, { role: 'ai', content: summary }]);
              if (currentIdea || activeHistoryId) {
                addPromptToHistory({
                  id: activeHistoryId || undefined,
                  title: (currentIdea && currentIdea.length > 36 ? currentIdea.slice(0, 36) + '...' : currentIdea) || 'Refined Prompt',
                  ideaText: currentIdea || 'Refined Prompt',
                  promptText: cleanMarkdown,
                  isPinned: false,
                });
              }
              recordExecutionTrace({
                node: 'PROMPT_REFINE',
                model: 'gemini-2.5-flash',
                tokens: Math.round((updatedMarkdown.length / 4) + (text.length / 4)),
                latency: 480,
                status: 'OK',
              });
            } catch (err: any) {
              console.error('Refinement failed:', err);
              const isKeyError = Boolean(
                err?.isApiKeyError ||
                err?.message?.toLowerCase().includes('api key') ||
                err?.message?.toLowerCase().includes('api_key')
              );
              if (isKeyError) {
                openApiKeyModal('API key rejected: Please update your key to continue.');
                setChatHistory(prev => [...prev, { 
                  role: 'ai', 
                  content: "⚠️ API Key Error: Your API key is invalid or not configured. Please enter a valid API key in the app to continue refinement." 
                }]);
              } else {
                setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error while updating the document." }]);
              }
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
        <div className="flex items-center gap-2.5">
          {isSwapped && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer mr-1 group shadow-sm"
              title={isSidebarCollapsed ? "Show previous prompts (History)" : "Hide history sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-copper-400 group-hover:scale-110 transition-transform" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-neutral-400 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-xs font-mono text-neutral-300">History</span>
            </button>
          )}
          <div className="font-display font-medium text-white text-[15px]">
            Bedrock App Prompt <span className="font-mono text-xs text-gray-500 ml-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">MD</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 1-Click Save to Project Folder */}
          <button 
            type="button"
            onClick={handleQuickSaveCursorRules}
            disabled={isSavingDirect}
            className={cn(
              "px-3.5 py-1.5 border transition-all rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]",
              directSaveToast
                ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                : "bg-emerald-500/15 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 hover:text-white"
            )}
            title="1-Click direct file saving of .cursorrules to your project folder"
          >
            <HardDrive className={cn("w-3.5 h-3.5", directSaveToast ? "text-black" : "text-emerald-400")} />
            <span>{isSavingDirect ? 'Writing...' : directSaveToast || 'Save .cursorrules'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-1.5 bg-copper-500/15 border border-copper-500/30 hover:border-copper-500/60 text-copper-300 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
            title="Export as .cursorrules, CLAUDE.md, Vercel AI SDK, Python, or API payload"
          >
            <Code2 className="w-3.5 h-3.5 text-copper-400" />
            <span>Export Blueprint</span>
          </button>
          <button 
            type="button"
            onClick={handleCopy} 
            className={cn(
              "px-3 py-1.5 border transition-colors rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer",
              copied 
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" 
                : "bg-[#222] border-white/10 hover:bg-white/10 text-gray-200"
            )}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-gray-400" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={handleDownload} 
            className="px-3 py-1.5 bg-[#222] border border-white/10 hover:bg-white/10 transition-colors rounded-lg text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3 h-3 text-gray-400" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative" data-lenis-prevent="true">
        <div className={`max-w-4xl mx-auto prose prose-invert prose-copper prose-p:leading-relaxed prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-headings:font-display transition-opacity duration-300 ${isRefining ? 'opacity-30' : 'opacity-100'}`}>
          <ReactMarkdown>{sanitizeRenderedPrompt(promptText)}</ReactMarkdown>
        </div>
      </div>

    </div>
  );

  return (
    <PageTransition className={cn(
      "relative flex flex-col text-white font-sans selection:bg-copper-500/30 overflow-hidden",
      isDesktop ? "h-full" : "h-[calc(100vh-80px)]"
    )}>
      {/* Generator History Sidebar (Allows browsing all previously generated prompts) */}
      <GeneratorHistorySidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        activeId={activeHistoryId}
        onSelectPrompt={handleSelectPrompt}
        onNewPrompt={handleNewPrompt}
      />

      {/* Mobile backdrop overlay */}
      {!isSidebarCollapsed && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
        />
      )}

      {/* Main Split Pane Workspace */}
      <div className={cn(
        "w-full h-full flex flex-col transition-all duration-300",
        !isSidebarCollapsed ? (isDesktop ? "pl-72 md:pl-76" : "md:pl-72 lg:pl-76") : ""
      )}>
        {/* Split Pane Workspace */}
        <PanelGroup orientation="horizontal" className="w-full h-full">
        
        {/* LEFT PANE */}
        <Panel 
          id="left-panel" 
          defaultSize="45%" 
          minSize="30%" 
          maxSize="70%" 
          className="relative overflow-hidden bg-[#0a0a0a]"
        >
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
        <Panel 
          id="right-panel" 
          defaultSize="55%" 
          minSize="30%" 
          maxSize="70%" 
          className="relative overflow-hidden bg-[#161616]"
        >
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
      </div>

      {/* Full Screen PixelCard Loading Overlay for Refinements / Follow-ups */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isRefining && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center bg-black overflow-hidden"
            >
              <PixelCard
                active={true}
                variant="copper"
                gap={28}
                speed={30}
                className="w-full h-full !rounded-none !border-0 !bg-black flex flex-col items-center justify-center relative"
              >
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-lg select-none pointer-events-none">
                  {/* GPU Hardware-Composited Loading Ring (Will never freeze/stop) */}
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-copper-500/20 blur-md pointer-events-none" />
                    <svg className="w-full h-full" viewBox="0 0 48 48" fill="none">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-copper-500/25"
                      />
                    </svg>
                    <svg
                      className="absolute inset-0 w-full h-full gpu-spinner text-copper-400"
                      viewBox="0 0 48 48"
                      fill="none"
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="125.6"
                        strokeDashoffset="80"
                      />
                    </svg>
                  </div>
                  <div className="mt-6 text-white font-display font-medium text-2xl sm:text-3xl tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                    <EncryptedText
                      text="Applying Refinements"
                      encryptedClassName="text-neutral-500"
                      revealedClassName="text-white"
                      revealDelayMs={35}
                    />
                  </div>
                  <div className="mt-2.5 font-mono text-xs sm:text-sm uppercase tracking-widest drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                    <EncryptedText
                      text="SYNTHESIZING PROMPT CHANGES..."
                      encryptedClassName="text-copper-700/60"
                      revealedClassName="text-copper-400"
                      revealDelayMs={45}
                    />
                  </div>
                </div>
              </PixelCard>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Export Blueprint Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        promptText={promptText}
        title={currentIdea || 'Bedrock Prompt'}
      />
    </PageTransition>
  );
}
