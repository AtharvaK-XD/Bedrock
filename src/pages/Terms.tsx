import { Link } from 'react-router-dom';
import { PageTransition } from '../components/layout/PageTransition';
import { FileCheck, ArrowLeft, ShieldAlert, Cpu, Scale } from 'lucide-react';

export default function Terms() {
  const lastUpdated = 'September 30, 2026';

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050505] text-[#e4e4e7] selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-500/60 transition-colors">
                <span className="font-bold text-emerald-400 text-sm">B</span>
              </div>
              <span className="font-semibold text-white tracking-tight">Bedrock</span>
            </Link>

            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-zinc-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24">
          {/* Header */}
          <div className="mb-12 border-b border-white/[0.08] pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <FileCheck className="w-3.5 h-3.5" />
              Terms of Agreement
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
              Terms of Service
            </h1>
            <p className="text-sm text-zinc-400">
              Last updated: {lastUpdated} • Effective Date: {lastUpdated}
            </p>
          </div>

          {/* Quick Summary Card */}
          <div className="mb-12 p-6 rounded-2xl bg-zinc-900/40 border border-white/[0.08] backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Key Points at a Glance
            </h2>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>You retain full intellectual property rights to the prompts, system instructions, and workflows you create using Bedrock.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>You agree not to use Bedrock to generate malware, hate speech, or bypass automated AI safety filters.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>AI model outputs are generated non-deterministically; you are responsible for testing and verifying generated prompt performance.</span>
              </li>
            </ul>
          </div>

          {/* Detailed Terms Sections */}
          <div className="space-y-10 text-zinc-300 text-sm sm:text-base leading-relaxed">
            
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account, accessing, or using the Bedrock workstation or web platform at <span className="text-emerald-400">https://bedrock-steel.vercel.app</span>, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not access or use the service.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                2. Use of the Bedrock Platform
              </h2>
              <p className="mb-3">
                Bedrock provides developers and prompt engineers with system prompt synthesis, visual execution branching graphs, and model benchmarking tools. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-400">
                <li>Provide accurate account information during Google or GitHub authentication.</li>
                <li>Maintain the confidentiality and security of any API keys or credentials you store in your workspace.</li>
                <li>Use the service solely in compliance with applicable local, state, national, and international laws.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                3. Prohibited Activities
              </h2>
              <p className="mb-3">You agree not to engage in any of the following restricted actions:</p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-400">
                <li>Using Bedrock to synthesize prompts intended to elicit cyberattacks, malicious payloads, hate speech, or illegal activities.</li>
                <li>Attempting to probe, scan, or breach the security of our API gateways, database clusters, or rate-limiting safeguards.</li>
                <li>Redistributing or reselling access to Bedrock platform infrastructure without explicit written authorization.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                4. Intellectual Property & Ownership
              </h2>
              <p className="mb-3">
                <strong>Your Content:</strong> You own all right, title, and interest in and to your user prompts, system persona formulations, and pipeline branching topologies created within Bedrock. We claim no intellectual property rights over the prompts or outputs you synthesize.
              </p>
              <p>
                <strong>Bedrock Platform:</strong> The Bedrock interface, design systems, algorithms, source code, and brand marks are the exclusive property of Bedrock Inc.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                5. Third-Party AI Services & Disclaimers
              </h2>
              <p className="mb-3">
                Bedrock interfaces with third-party language model providers (including Groq, Google Gemini, OpenRouter, and Hugging Face). You acknowledge that AI-generated outputs are probabilistic and non-deterministic.
              </p>
              <p>
                THE BEDROCK PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                6. Limitation of Liability
              </h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL BEDROCK, ITS FOUNDERS, OR CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
              </p>
            </section>

            {/* Section 7 */}
            <section className="pt-6 border-t border-white/[0.08]">
              <h2 className="text-xl font-semibold text-white mb-4">
                7. Contact Information
              </h2>
              <p className="text-zinc-400">
                For questions regarding these Terms of Service, please contact:
              </p>
              <div className="mt-3 p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] text-sm space-y-1">
                <p className="text-white font-medium">Bedrock Operations</p>
                <p className="text-zinc-400">Support: <a href="mailto:bedrockofficialpage@gmail.com" className="text-emerald-400 hover:underline">bedrockofficialpage@gmail.com</a></p>
                <p className="text-zinc-400">Developer Contact: <a href="mailto:kulkarniatharva529@gmail.com" className="text-emerald-400 hover:underline">kulkarniatharva529@gmail.com</a></p>
              </div>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="w-full py-8 border-t border-white/[0.08] text-center text-xs text-zinc-500">
          <p>© 2026 Bedrock. All rights reserved.</p>
        </footer>
      </div>
    </PageTransition>
  );
}
