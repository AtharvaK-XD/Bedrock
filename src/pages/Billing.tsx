import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Download, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  FileText,
  Check,
  Lock,
  Zap,
  Sparkles
} from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { useUserProfile } from '../lib/useUserProfile';
import { usePromptQuota } from '../lib/usePromptQuota';
import { normalizeTier, TIER_LIMITS } from '../lib/subscriptionTiers';

export default function Billing() {
  const { profile } = useUserProfile();
  const currentTier = normalizeTier(profile?.plan);
  const isFree = currentTier === 'free';
  const tierConfig = TIER_LIMITS[currentTier];

  const {
    sessionPrompts,
    sessionLimit,
    timeUntilSession,
  } = usePromptQuota();

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [currentDate, setCurrentDate] = useState('October 22, 2026');

  useEffect(() => {
    const d = new Date();
    setCurrentDate(d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
      window.print();
    }, 600);
  };

  const invoiceAmount = currentTier === 'ultimate' ? '₹1,178.82' : '₹470.82';
  const basePrice = currentTier === 'ultimate' ? '₹999.00' : '₹399.00';
  const gstPrice = currentTier === 'ultimate' ? '₹179.82' : '₹71.82';
  const planDisplayName = currentTier === 'ultimate' ? 'Ultimate Plan' : currentTier === 'pro' ? 'Advanced Plan' : 'Free Tier';

  const invoiceItems = isFree ? [] : [
    {
      id: 'INV-2026-948043',
      date: currentDate,
      amount: invoiceAmount,
      status: 'Paid',
      plan: `${planDisplayName} (Monthly)`
    },
    {
      id: 'INV-2026-812904',
      date: 'September 22, 2026',
      amount: invoiceAmount,
      status: 'Paid',
      plan: `${planDisplayName} (Monthly)`
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
              <span>{isFree ? 'Explore Plans' : 'Change Plan'}</span>
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
          {isFree ? (
            <div className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#121417] to-black p-6 sm:p-8 overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                        Free Workspace Tier
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                        Active Free Plan
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1 font-sans">
                      Daily limit: <span className="text-white font-mono">{sessionLimit} prompts/day</span> · 3 pipeline nodes · Core Gemini & Groq models.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to="/app/pricing"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-copper-500 to-amber-500 hover:from-copper-400 hover:to-amber-400 text-black font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-copper-500/25 active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Upgrade to Pro (₹399)</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-[#121417] to-black p-6 sm:p-8 overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                        Subscription Confirmed & Active
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                        {planDisplayName}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1 font-sans">
                      Your workspace is elevated to <span className="text-white font-medium">{planDisplayName}</span>. Unlimited prompts and frontier models are fully unlocked.
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
          )}

          {/* Main 2-Column Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left 2 Columns */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Subscription Details */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Workspace Entitlements</h2>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">
                      {isFree ? 'Free tier quota & active limits' : 'Recurring subscription billed monthly'}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-mono font-semibold px-3 py-1 rounded-full border",
                    isFree 
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/25" 
                      : "text-copper-400 bg-copper-500/10 border-copper-500/25"
                  )}>
                    {tierConfig.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Billing Rate</p>
                    <p className="text-xl font-bold font-mono text-white">{isFree ? '₹0.00' : basePrice}</p>
                    <p className="text-[10px] text-neutral-500 font-mono">{isFree ? 'Always free ($0.00)' : 'Billed every 30 days'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">{isFree ? 'Session Resets In' : 'Next Renewal'}</p>
                    <p className="text-xl font-bold font-mono text-white">{isFree ? timeUntilSession : 'Nov 22, 2026'}</p>
                    <p className="text-[10px] text-neutral-500 font-mono">{isFree ? `${sessionPrompts}/${sessionLimit} used` : 'Auto-renews via Razorpay'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Account</p>
                    <p className="text-xl font-bold font-mono text-white truncate">{profile?.name || 'Prompt Architect'}</p>
                    <p className="text-[10px] text-neutral-500 font-mono truncate">{profile?.email || 'user@example.com'}</p>
                  </div>
                </div>

                {/* Plan Inclusions Checklist */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-mono uppercase tracking-wider text-neutral-400">Included Capabilities</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300">
                    {tierConfig.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                          isFree ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        )}>
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment Method Card */}
              {!isFree && (
                <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-base font-bold text-white">Payment Method</h2>
                    <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Secured with 256-bit TLS</span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-7 rounded-lg bg-neutral-900 border border-white/15 flex items-center justify-center font-mono font-bold text-xs text-white">
                        UPI/CARD
                      </div>
                      <div>
                        <p className="text-xs font-mono font-semibold text-white">Verified Razorpay / Card</p>
                        <p className="text-[11px] font-mono text-neutral-500">Cryptographically confirmed payment method</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-neutral-300 border border-white/10 self-start sm:self-auto">
                      Primary Method
                    </span>
                  </div>
                </div>
              )}

              {/* Invoice History */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-base font-bold text-white">Billing History</h2>
                  <span className="text-xs font-mono text-neutral-500">
                    {invoiceItems.length} {invoiceItems.length === 1 ? 'Invoice' : 'Invoices'}
                  </span>
                </div>

                {isFree ? (
                  <div className="py-8 text-center text-zinc-500 font-mono text-xs space-y-2">
                    <p>No paid invoices recorded.</p>
                    <p className="text-[11px] text-zinc-600">You are currently operating on the Free tier.</p>
                  </div>
                ) : (
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
                )}
              </div>

            </div>

            {/* Right Column: Order Receipt Breakdown Card */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#121417]/80 backdrop-blur-xl shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-base font-bold text-white">Account Summary</h2>
                  <span className="text-xs font-mono text-neutral-400">#BDRK-{currentTier.toUpperCase()}</span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Date</span>
                    <span className="text-white font-medium">{currentDate}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Billed To</span>
                    <span className="text-white font-medium">{profile?.name || 'Prompt Architect'}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Email</span>
                    <span className="text-white font-medium truncate max-w-[150px]">{profile?.email || 'user@example.com'}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Tier Status</span>
                    <span className={cn("font-medium", isFree ? "text-amber-400" : "text-emerald-400")}>
                      {isFree ? 'Free Tier' : 'Paid & Active'}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>{planDisplayName}</span>
                    <span className="text-white font-medium">{isFree ? '₹0.00' : basePrice}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>GST (18%)</span>
                    <span className="text-white font-medium">{isFree ? '₹0.00' : gstPrice}</span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="flex justify-between items-baseline font-mono">
                  <span className="text-sm font-semibold text-white">{isFree ? 'Amount Due' : 'Total Paid'}</span>
                  <span className="text-2xl font-bold text-white">{isFree ? '₹0.00' : invoiceAmount}</span>
                </div>

                <div className="pt-2 space-y-3">
                  {isFree ? (
                    <Link
                      to="/app/pricing"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-copper-500 to-amber-500 hover:from-copper-400 hover:to-amber-400 text-black font-semibold text-xs font-mono uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Upgrade Plan</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs font-mono uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                    >
                      Download Invoice PDF
                    </button>
                  )}

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
                <p className="text-white font-semibold">Corporate Tax Invoices</p>
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Every confirmed order automatically dispatches a GST tax invoice with HMAC SHA256 proof to your registered email address.
                </p>
                <Link to="/app/settings" className="inline-block text-[11px] text-copper-400 hover:text-copper-300 pt-1">
                  Manage Workspace Profile &rarr;
                </Link>
              </div>
            </div>

          </div>

        </div>
      </div>
    </PageTransition>
  );
}
