import { useState } from 'react';
import { FlaskConical, Play, ChevronDown, Settings } from 'lucide-react';
import { AI_AGENTS } from '../components/ui/RichInput';
import { cn } from '../lib/utils';

export default function PromptTester() {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState('');
  
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(AI_AGENTS[0].id);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(AI_AGENTS[0].models[0].id);

  const handleTest = () => {
    if (!prompt.trim()) return;
    setIsTesting(true);
    
    // Mock API Call
    setTimeout(() => {
      setResult(`Based on your prompt, here is the simulated response from the selected model. \n\nThe model successfully parsed your instructions and outputted the desired format.`);
      setIsTesting(false);
    }, 2000);
  };

  const selectedAgent = AI_AGENTS.find(a => a.id === selectedAgentId) || AI_AGENTS[0];
  const selectedModel = selectedAgent.models.find(m => m.id === selectedModelId) || selectedAgent.models[0];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 lg:py-20 min-h-[calc(100vh-80px)]">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-copper-500/10 rounded-2xl mb-6 text-copper-500 shadow-inner">
          <FlaskConical className="w-8 h-8" />
        </div>
        <h1 className="text-5xl md:text-6xl font-display font-bold text-basalt-900 mb-6 tracking-tight">
          Prompt Tester.
        </h1>
        <p className="text-xl text-basalt-600 max-w-2xl mx-auto">
          Test your prompts instantly against multiple LLMs to see how they perform before deploying them to production.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: Input */}
        <div className="flex flex-col h-[650px] gap-6">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl p-6 flex flex-col flex-1 relative overflow-hidden group">
            <h3 className="text-sm font-semibold text-basalt-500 mb-2 uppercase tracking-wider">System Prompt (Optional)</h3>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              data-lenis-prevent="true"
              className="w-full h-24 resize-none bg-white/50 border border-basalt-900/10 rounded-xl p-4 text-sm text-basalt-900 focus:outline-none focus:ring-2 focus:ring-copper-500/50 mb-6 custom-scrollbar"
            />
            
            <h3 className="text-sm font-semibold text-basalt-500 mb-2 uppercase tracking-wider">User Prompt</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt you want to test..."
              data-lenis-prevent="true"
              className="w-full flex-1 resize-none bg-transparent text-base text-basalt-900 placeholder:text-basalt-400 focus:outline-none custom-scrollbar"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-4 bg-white border border-basalt-900/10 rounded-xl text-base font-medium text-basalt-900 hover:bg-basalt-900/5 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <selectedAgent.icon className="w-5 h-5 text-basalt-500 shrink-0" />
                  <span className="truncate">{selectedAgent.name}</span>
                </div>
                <ChevronDown className="w-5 h-5 text-basalt-400 shrink-0" />
              </button>
              
              {isAgentDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-72 bg-white border border-basalt-900/10 rounded-xl shadow-xl z-20 py-2 overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto px-1 custom-scrollbar" data-lenis-prevent="true">
                    {AI_AGENTS.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setSelectedModelId(agent.models[0].id);
                          setIsAgentDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-lg transition-colors",
                          selectedAgentId === agent.id ? "bg-basalt-900/5" : "hover:bg-basalt-900/5"
                        )}
                      >
                        <agent.icon className={cn("w-5 h-5 mt-0.5 shrink-0", selectedAgentId === agent.id ? "text-copper-600" : "text-basalt-500")} />
                        <div className="min-w-0">
                          <div className={cn("text-sm font-medium truncate", selectedAgentId === agent.id ? "text-basalt-900" : "text-basalt-800")}>{agent.name}</div>
                          <div className="text-xs text-basalt-500 mt-0.5 truncate">{agent.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-4 bg-white border border-basalt-900/10 rounded-xl text-base font-medium text-basalt-900 hover:bg-basalt-900/5 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <Settings className="w-5 h-5 text-basalt-500 shrink-0" />
                  <span className="truncate">{selectedModel.name}</span>
                </div>
                <ChevronDown className="w-5 h-5 text-basalt-400 shrink-0" />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-full bg-white border border-basalt-900/10 rounded-xl shadow-xl z-20 py-2">
                  <div className="px-3 py-2 text-xs font-semibold text-basalt-400 uppercase tracking-wider border-b border-basalt-900/5 mb-2">
                    {selectedAgent.name} Models
                  </div>
                  <div className="max-h-[300px] overflow-y-auto px-2 custom-scrollbar" data-lenis-prevent="true">
                    {selectedAgent.models.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(model.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 text-sm text-left rounded-lg transition-colors",
                          selectedModelId === model.id ? "bg-basalt-900/5 text-basalt-900 font-medium" : "text-basalt-700 hover:bg-basalt-900/5 hover:text-basalt-900"
                        )}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleTest}
              disabled={!prompt.trim() || isTesting}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-copper-500 text-white rounded-xl font-medium transition-all hover:bg-copper-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-copper-500/20 w-full sm:w-auto shrink-0"
            >
              {isTesting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Play className="w-5 h-5" />
              )}
              {isTesting ? 'Running...' : 'Run Test'}
            </button>
          </div>
        </div>

        {/* Right: Output */}
        <div className="flex flex-col h-[650px]">
          <div className="bg-[#131518] rounded-3xl p-8 flex flex-col h-full shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Output View
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar relative z-10" data-lenis-prevent="true">
              {isTesting ? (
                <div className="h-full flex items-center justify-center text-basalt-500">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-basalt-700 border-t-copper-500 rounded-full animate-spin"></div>
                    <p>Awaiting response from {selectedModel.name}...</p>
                  </div>
                </div>
              ) : result ? (
                <pre className="whitespace-pre-wrap font-mono text-[13px] sm:text-sm text-basalt-100 leading-relaxed">
                  {result}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-basalt-600 italic">
                  Run a test to see the model's output here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
