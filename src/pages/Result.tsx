import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Download, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const promptText = location.state?.promptText as string | undefined;

  if (!promptText) {
    return (
      <div className="flex items-center justify-center min-h-screen text-basalt-700">
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

  return (
    <div className="max-w-4xl mx-auto pt-24 px-4 pb-32">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="border-copper-500/20 shadow-[0_0_40px_rgba(44,154,139,0.1)]">
          <CardHeader>
            <CardTitle className="text-3xl">Your Bedrock Prompt</CardTitle>
            <CardDescription>Ready to be pasted into your AI coding agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-copper-500/20 to-copper-400/20 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative bg-[#131518]/80 backdrop-blur-sm border border-basalt-900/10 rounded-xl p-8 overflow-auto max-h-[50vh] custom-scrollbar">
                <pre className="whitespace-pre-wrap font-mono text-[13px] sm:text-sm text-basalt-900/90 leading-relaxed">
                  {promptText}
                </pre>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="text-basalt-700">
              <RefreshCcw className="w-4 h-4 mr-2" /> Start Over
            </Button>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="secondary" onClick={handleDownload} className="flex-1 sm:flex-none">
                <Download className="w-4 h-4 mr-2" /> Download .md
              </Button>
              <Button onClick={handleCopy} className="flex-1 sm:flex-none w-full sm:w-40">
                <Copy className="w-4 h-4 mr-2" /> Copy
              </Button>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
