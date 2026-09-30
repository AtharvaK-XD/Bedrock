import { Link } from 'react-router-dom';
import { PageTransition } from '../components/layout/PageTransition';
import { Shield, ArrowLeft, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';

export default function Privacy() {
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
              <Link to="/terms" className="text-zinc-400 hover:text-white transition-colors">
                Terms of Service
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
              <Shield className="w-3.5 h-3.5" />
              Legal & Transparency
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
              Privacy Policy
            </h1>
            <p className="text-sm text-zinc-400">
              Last updated: {lastUpdated} • Effective Date: {lastUpdated}
            </p>
          </div>

          {/* Quick Summary Card */}
          <div className="mb-12 p-6 rounded-2xl bg-zinc-900/40 border border-white/[0.08] backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Summary of Our Core Privacy Principles
            </h2>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>We only collect the minimum information necessary to authenticate your account and store your synthesized prompt pipelines.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>We NEVER sell or monetize your personal information or Google account data.</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>We do NOT use your prompts or private data to train generalized AI/ML models.</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>You maintain 100% ownership of your prompts, execution graphs, and configurations.</span>
              </li>
            </ul>
          </div>

          {/* Detailed Policy Sections */}
          <div className="space-y-10 text-zinc-300 text-sm sm:text-base leading-relaxed">
            
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                1. Information We Collect
              </h2>
              <p className="mb-3">
                When you access or use Bedrock (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) via our web application (<span className="text-emerald-400">https://bedrock-steel.vercel.app</span>) or native desktop workstation, we collect information in the following ways:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-400">
                <li>
                  <strong className="text-zinc-200">Account and Identity Data:</strong> When you register or sign in using OAuth identity providers (such as Google or GitHub), we receive your primary email address, full name, and avatar URL to create and identify your account.
                </li>
                <li>
                  <strong className="text-zinc-200">User Content and Pipelines:</strong> System instructions, prompts, custom node configurations, and execution traces that you voluntarily create or save within the visual branching canvas.
                </li>
                <li>
                  <strong className="text-zinc-200">Technical and Diagnostic Data:</strong> IP address, device operating system, browser user-agent, and anonymized performance metrics to ensure zero-downtime availability and defense against abusive automation.
                </li>
              </ul>
            </section>

            {/* Section 2 - Google API User Data Disclosure (Strict compliance for Google OAuth verification) */}
            <section className="p-6 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-400" />
                2. Google OAuth & User Data Policy Compliance
              </h2>
              <p className="mb-3">
                Bedrock&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{' '}
                <a 
                  href="https://developers.google.com/terms/api-services-user-data-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline hover:text-emerald-300"
                >
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-300">
                <li>
                  <strong>Scope of Access:</strong> We strictly request only basic identification scopes (<code className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-emerald-300">openid</code>, <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-emerald-300">userinfo.email</code>, and <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-emerald-300">userinfo.profile</code>).
                </li>
                <li>
                  <strong>Purpose of Access:</strong> We access this information solely to establish your authenticated Bedrock session and associate your saved prompt templates with your account.
                </li>
                <li>
                  <strong>No Data Selling:</strong> We do not sell, rent, or transfer your Google user data to any external advertising platforms, data brokers, or information resellers.
                </li>
                <li>
                  <strong>No AI Training on Google Data:</strong> Google user data is never used to train, retrain, or improve generalized machine learning or artificial intelligence models.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                3. How We Use Your Information
              </h2>
              <p className="mb-3">We utilize collected data exclusively to:</p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-400">
                <li>Provide, authenticate, and maintain your personal Bedrock workspace.</li>
                <li>Execute prompt synthesis routines and evaluate prompt metrics per your request.</li>
                <li>Prevent denial-of-service attacks, prompt injection exploits, and unauthorized API abuse.</li>
                <li>Provide technical support and notify you of critical security or system updates.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                4. Third-Party Service Providers
              </h2>
              <p className="mb-3">
                We work with industry-standard, secure infrastructure partners to operate Bedrock:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-400">
                <li><strong className="text-zinc-200">Clerk:</strong> Secure authentication, session tokens, and identity routing.</li>
                <li><strong className="text-zinc-200">Neon (Serverless Postgres):</strong> Encrypted PostgreSQL database hosting for pipeline storage.</li>
                <li><strong className="text-zinc-200">Vercel:</strong> Global CDN hosting and serverless edge deployment.</li>
                <li><strong className="text-zinc-200">AI Model Providers:</strong> Groq, Google Cloud Vertex / Gemini, OpenRouter, and Hugging Face are queried strictly at your explicit instruction when you test or synthesize prompts.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                5. Data Security & Retention
              </h2>
              <p className="text-zinc-300">
                We implement industry-standard encryption protocols (HTTPS/TLS 1.3 in transit and AES-256 at rest) to safeguard your account records. API keys entered in your personal settings are encrypted and never exposed in client bundles. We retain your information as long as your account remains active.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                6. Your Rights & Data Deletion
              </h2>
              <p className="text-zinc-300 mb-3">
                Regardless of your jurisdiction (including under GDPR and CCPA), you have the right to access, rectify, export, or permanently delete your account data.
              </p>
              <p className="text-zinc-300">
                To request complete data deletion, simply send an email to{' '}
                <a href="mailto:bedrockofficialpage@gmail.com" className="text-emerald-400 underline hover:text-emerald-300">
                  bedrockofficialpage@gmail.com
                </a>{' '}
                or reach our developer desk at{' '}
                <a href="mailto:kulkarniatharva529@gmail.com" className="text-emerald-400 underline hover:text-emerald-300">
                  kulkarniatharva529@gmail.com
                </a>. All associated records will be purged within 48 business hours.
              </p>
            </section>

            {/* Section 7 */}
            <section className="pt-6 border-t border-white/[0.08]">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                7. Contact Information
              </h2>
              <p className="text-zinc-400">
                If you have any questions or feedback regarding this Privacy Policy or our security standards, please contact us:
              </p>
              <div className="mt-3 p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] text-sm space-y-1">
                <p className="text-white font-medium">Bedrock Operations</p>
                <p className="text-zinc-400">Support Email: <a href="mailto:bedrockofficialpage@gmail.com" className="text-emerald-400 hover:underline">bedrockofficialpage@gmail.com</a></p>
                <p className="text-zinc-400">Developer Contact: <a href="mailto:kulkarniatharva529@gmail.com" className="text-emerald-400 hover:underline">kulkarniatharva529@gmail.com</a></p>
                <p className="text-zinc-400">Website: <a href="https://bedrock-steel.vercel.app" className="text-emerald-400 hover:underline">https://bedrock-steel.vercel.app</a></p>
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
