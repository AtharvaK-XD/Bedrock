import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Download, RefreshCcw, FileText, Sparkles, Terminal } from 'lucide-react';
import { RefinementInput } from '../components/ui/RefinementInput';

const TypewriterText = ({ text }: { text: string }) => {
  const words = text.split(' ');

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.04 }
        }
      }}
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

  if (!promptText) {
    return (
      <div className="flex items-center justify-center min-h-screen text-basalt-900">
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
    <div className="flex flex-col min-h-[calc(100vh-80px)] text-basalt-900 font-sans selection:bg-copper-500/30 pt-6">
      
      {/* Header / Top Nav */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-basalt-900/10 mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-basalt-700">
          <Terminal className="w-5 h-5 text-copper-500" />
          <span>Bedrock Agent</span>
        </div>
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-basalt-600 hover:text-basalt-900 transition-colors rounded-lg hover:bg-basalt-900/5"
        >
          <RefreshCcw className="w-4 h-4" /> Start Over
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto pb-40 px-4 custom-scrollbar">
        <div className="max-w-3xl mx-auto flex flex-col gap-10">
          
          {/* User Message */}
          {idea && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <div className="bg-basalt-900/5 border border-basalt-900/10 text-basalt-900 px-5 py-3.5 rounded-3xl rounded-tr-sm max-w-[85%] text-[15px] leading-relaxed shadow-sm">
                {idea}
              </div>
            </motion.div>
          )}

          {/* AI Response */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-start"
          >
            <div className="flex flex-col gap-4 max-w-[95%] md:max-w-[85%]">
              
              {/* Status / Metadata */}
              <div className="flex items-center gap-2 text-basalt-500 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-copper-500" />
                Synthesized your prompt
              </div>
              
              {/* AI Text */}
              <div className="text-[15.5px] leading-relaxed text-basalt-800">
                <TypewriterText text="Here is the standalone prompt covering your requirements. You can hand this to an AI coding agent without it trying to rebuild things that already exist." />
              </div>

              {/* Attachment Block */}
              <div className="mt-2 flex flex-col sm:flex-row items-center justify-between bg-white border border-basalt-900/10 rounded-2xl p-4 gap-4 hover:border-basalt-900/20 transition-colors shadow-sm">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="bg-basalt-900/5 p-3.5 rounded-xl flex-shrink-0 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-basalt-500" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="font-medium text-basalt-900 truncate text-[15px]">Bedrock prompt</div>
                    <div className="text-[13px] text-basalt-500 mt-0.5">Document • MD</div>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleCopy} 
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-basalt-900/10 hover:bg-basalt-900/5 transition-colors rounded-xl text-sm font-medium text-basalt-900 shadow-sm"
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                  <button 
                    onClick={handleDownload} 
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-basalt-900/10 hover:bg-basalt-900/5 transition-colors rounded-xl text-sm font-medium text-basalt-900 shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </div>

      {/* Fixed Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto drop-shadow-2xl">
          <RefinementInput 
            onSubmit={(text, model) => {
              console.log("Refinement submitted:", text, "with model:", model);
            }}
          />
        </div>
      </div>
    </div>
  );
}
