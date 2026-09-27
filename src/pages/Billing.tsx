import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Download, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  FileText,
  Check
} from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { useUserProfile } from '../lib/useUserProfile';

export default function Billing() {
  const { profile, updateProfile } = useUserProfile();
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [currentDate, setCurrentDate] = useState('September 27, 2026');

  useEffect(() => {
    const d = new Date();
    setCurrentDate(d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));

    // Ensure user profile reflects upgraded plan
    if (profile.plan !== 'Advanced Plan' && profile.plan !== 'Pro Plan') {
      updateProfile({ plan: 'Advanced Plan' });
    }
  }, [profile.plan, updateProfile]);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
      
      // Trigger a clean print dialog for receipt
      window.print();
    }, 600);
  };

  const invoiceItems = [
    {
      id: 'INV-2026-948043',
      date: currentDate,
      amount: '₹470.82',
      status: 'Paid',
      plan: 'Advanced Plan (Monthly)'
    },
    {
      id: 'INV-2026-812904',
      date: 'August 27, 2026',
      amount: '₹470.82',
      status: 'Paid',
      plan: 'Advanced Plan (Monthly)'
    },
  ];

  return (
    <PageTransition>
      <div className="w-full min-h-[calc(100vh-80px)] bg-black text-white px-4 sm:px-8 py-8 lg:py-12">
        <div className="w-full max-w-6xl mx-auto space-y-8">
          
          {/* Top Breadcrumb & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link 
              to="/app/pricing" 
              className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Pricing</span>
            </Link>

            <Link 
              to="/app" 
              className="inline-flex items-center gap-2 text-xs font-mono text-copper-300 hover:text-copper-200 transition-colors uppercase tracking-wider bg-copper-500/10 hover:bg-copper-500/20 px-3.5 py-1.5 rounded-xl border border-copper-500/30"
            >
              <span>Go to Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Hero Confirmation Banner */}
          <div className="relative rounded-3xl border border-white/10 bg-[#121417]/85 backdrop-blur-2xl p-6 sm:p-8 overflow-hidden shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                      Subscription Confirmed
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      Active
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 mt-1 font-sans">
                    Your workspace has been upgraded to the <span className="text-white font-medium">Advanced Plan</span>. All features are fully unlocked.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs uppercase tracking-wider border border-white/15 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloading ? 'Preparing...' : downloadSuccess ? 'Downloaded' : 'Download Receipt'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main 2-Column Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left 2 Columns: Plan Overview + Payment Method + Invoice History */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Subscription Details */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Active Subscription</h2>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">Recurring subscription billed monthly</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-copper-400 bg-copper-500/10 px-3 py-1 rounded-full border border-copper-500/25">
                    Advanced Tier
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Billing Rate</p>
                    <p className="text-xl font-bold font-mono text-white">₹399.00</p>
                    <p className="text-[10px] text-neutral-500 font-mono">Billed every 30 days</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Next Renewal</p>
                    <p className="text-xl font-bold font-mono text-white">Oct 27, 2026</p>
                    <p className="text-[10px] text-neutral-500 font-mono">Auto-renews via Stripe</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Account</p>
                    <p className="text-xl font-bold font-mono text-white truncate">{profile.name}</p>
                    <p className="text-[10px] text-neutral-500 font-mono truncate">{profile.email}</p>
                  </div>
                </div>

                {/* Plan Inclusions Checklist */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-mono uppercase tracking-wider text-neutral-400">Included Plan Capabilities</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <span>Multi-agent reasoning pipelines</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <span>Unlimited prompt test runs & evaluations</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <span>LLaMA 3.1 70B & Gemini 2.5 Flash models</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <span>Priority execution latency queue</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Card */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-base font-bold text-white">Payment Method</h2>
                  <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Secured with Stripe</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-7 rounded-lg bg-neutral-900 border border-white/15 flex items-center justify-center font-mono font-bold text-xs text-white">
                      VISA
                    </div>
                    <div>
                      <p className="text-xs font-mono font-semibold text-white">Visa ending in 4242</p>
                      <p className="text-[11px] font-mono text-neutral-500">Expires 12/2028 · Default method</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-neutral-300 border border-white/10 self-start sm:self-auto">
                    Primary Card
                  </span>
                </div>
              </div>

              {/* Invoice History */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-base font-bold text-white">Billing History</h2>
                  <span className="text-xs font-mono text-neutral-500">2 Invoices</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  {invoiceItems.map((inv) => (
                    <div 
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-white">{inv.id}</p>
                          <p className="text-[11px] text-neutral-500">{inv.plan} · {inv.date}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <span className="font-bold text-white">{inv.amount}</span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {inv.status}
                        </span>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="text-[11px] text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Order Receipt Breakdown Card */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-base font-bold text-white">Latest Receipt</h2>
                  <span className="text-xs font-mono text-neutral-400">#BDRK-948043</span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Date</span>
                    <span className="text-white font-medium">{currentDate}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Billed To</span>
                    <span className="text-white font-medium">{profile.name}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Email</span>
                    <span className="text-white font-medium truncate max-w-[150px]">{profile.email}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Payment Method</span>
                    <span className="text-white font-medium">Visa •••• 4242</span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Advanced Plan</span>
                    <span className="text-white font-medium">₹399.00</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>GST (18%)</span>
                    <span className="text-white font-medium">₹71.82</span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="flex justify-between items-baseline font-mono">
                  <span className="text-sm font-semibold text-white">Total Paid</span>
                  <span className="text-2xl font-bold text-white">₹470.82</span>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs font-mono uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                  >
                    Download Invoice PDF
                  </button>

                  <Link
                    to="/app/generator"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-mono text-xs uppercase tracking-wider border border-white/10 transition-colors"
                  >
                    <span>Launch Prompt Builder</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Support & Inquiries */}
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] text-xs font-mono text-neutral-400 space-y-2">
                <p className="text-white font-semibold">Need invoice customization?</p>
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Add corporate GSTIN or company billing details anytime from your workspace settings.
                </p>
                <Link to="/app/settings" className="inline-block text-[11px] text-copper-400 hover:text-copper-300 pt-1">
                  Manage Billing Settings &rarr;
                </Link>
              </div>
            </div>

          </div>

        </div>
      </div>
    </PageTransition>
  );
}
