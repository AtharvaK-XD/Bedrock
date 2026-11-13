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
  AlertTriangle,
  RotateCcw,
  Loader2,
  X,
  Clock
} from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { useUserProfile } from '../lib/useUserProfile';
import { usePromptQuota } from '../lib/usePromptQuota';
import { normalizeTier, TIER_LIMITS } from '../lib/subscriptionTiers';
import { getPlanPrice, planPriceLabel } from '../lib/pricing';
import { getAuthHeaders } from '../lib/api';

export interface PaymentHistoryItem {
  orderId: string;
  paymentId: string | null;
  tier: 'pro' | 'ultimate';
  planName: string;
  amountPaise: number;
  basePaise: number;
  gstPaise: number;
  currency: string;
  status: 'paid';
  orderedAt: string;
  paidAt: string;
}

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
  const [currentDate, setCurrentDate] = useState('Today');
  const [historyItems, setHistoryItems] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentHistoryItem | null>(null);

  useEffect(() => {
    const d = new Date();
    setCurrentDate(d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  // Fetch real payment receipts from GET /api/billing/history
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        setLoadingHistory(true);
        setHistoryError(null);
        const headers = await getAuthHeaders();
        const res = await fetch('/api/billing/history', { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.items)) {
            setHistoryItems(data.items);
          }
        } else if (res.status !== 401) {
          const errData = await res.json().catch(() => ({}));
          if (isMounted) {
            setHistoryError(errData.message || 'Could not load payment history.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setHistoryError(err?.message || 'Failed to connect to billing service.');
        }
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
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

  const planPrice = getPlanPrice(currentTier === 'ultimate' ? 'ultimate' : 'pro');
  const planDisplayName = currentTier === 'ultimate' ? 'Ultimate Plan' : currentTier === 'pro' ? 'Pro Plan' : 'Free Tier';

  // Format currency helpers
  const formatAmount = (subunits: number, currency = 'INR') => {
    if (currency === 'USD') {
      return `$${(subunits / 100).toFixed(2)}`;
    }
    return `₹${(subunits / 100).toLocaleString('en-IN')}`;
  };

  // Expiry formatting
  const planExpiresAtFormatted = profile?.planExpiresAt
    ? new Date(profile.planExpiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  const isExpired = Boolean(profile?.planExpired);

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
              <span>{isFree ? 'Explore Plans' : currentTier === 'ultimate' ? 'Plan Overview' : 'Upgrade Plan'}</span>
            </Link>

            <Link 
              to="/app" 
              className="inline-flex items-center gap-2 text-xs font-mono text-copper-300 hover:text-copper-200 transition-colors uppercase tracking-wider bg-copper-500/10 hover:bg-copper-500/20 px-3.5 py-1.5 rounded-xl border border-copper-500/30"
            >
              <span>Go to Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Hero Confirmation / Expiry Banner */}
          {isExpired ? (
            <div className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-sf-121417 to-black p-6 sm:p-8 overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                        30-Day Access Period Expired
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                        Expired {planExpiresAtFormatted || ''}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1 font-sans">
                      Your access pass has concluded. Renew to instantly unlock unlimited generations and all frontier reasoning models.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to="/app/pricing"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-amber-500/25 active:scale-[0.98]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Renew Plan Pass</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : isFree ? (
            <div className="relative rounded-3xl border border-copper-500/30 bg-gradient-to-r from-copper-500/10 via-sf-121417 to-black p-6 sm:p-8 overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-copper-500/15 border border-copper-500/30 flex items-center justify-center text-copper-400 shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                        Free Workspace Tier
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-copper-500/15 text-copper-300 border border-copper-500/30 uppercase tracking-wider">
                        Active Free Plan
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1 font-sans">
                      Daily quota: <span className="text-white font-mono">{sessionLimit} prompts/day</span> · Core Gemini & Groq models · 5 pipeline nodes.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to="/app/pricing"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-copper-500/25 active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Upgrade ({planPriceLabel('pro')})</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-sf-121417 to-black p-6 sm:p-8 overflow-hidden shadow-2xl">
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
                      Your workspace is elevated to <span className="text-white font-medium">{planDisplayName}</span>.
                      {planExpiresAtFormatted 
                        ? ` Active until ${planExpiresAtFormatted} (30 days per payment · no recurring charge).` 
                        : ' Unlimited prompts and frontier models are fully unlocked.'}
                    </p>
                    <div className="flex items-center gap-2.5 mt-3 p-3 rounded-xl bg-copper-500/10 border border-copper-500/25 text-copper-300 text-xs font-mono">
                      <Clock className="w-4 h-4 text-copper-400 shrink-0" />
                      <span>Activation Notice: Pro and Ultimate workspace tiers and dedicated model allocations fully activate within 24 hours of payment confirmation.</span>
                    </div>
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
                    <span>{downloading ? 'Preparing...' : downloadSuccess ? 'Downloaded' : 'Print Invoice'}</span>
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
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-sf-121417/60 backdrop-blur-xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Workspace Entitlements</h2>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">
                      {isFree ? 'Free tier quota & active limits' : '30-day access pass · No auto-renew'}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-mono font-semibold px-3 py-1 rounded-full border",
                    isFree 
                      ? "text-zinc-300 bg-white/5 border-white/10" 
                      : "text-copper-400 bg-copper-500/10 border-copper-500/25"
                  )}>
                    {tierConfig.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Pass Rate</p>
                    <p className="text-xl font-bold font-mono text-white">
                      {isFree ? '₹0.00' : `${planPrice.symbol}${planPrice.base}`}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {isFree ? 'Always free ($0.00)' : 'Per 30-day term'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                      {isFree ? 'Session Resets In' : 'Access Valid Until'}
                    </p>
                    <p className="text-xl font-bold font-mono text-white">
                      {isFree ? timeUntilSession : planExpiresAtFormatted || 'Active'}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {isFree ? `${sessionPrompts}/${sessionLimit} used` : 'No surprise auto-charges'}
                    </p>
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
                          isFree ? "bg-copper-500/15 border-copper-500/30 text-copper-400" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        )}>
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Verified Gateway Badging */}
              {!isFree && (
                <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-sf-121417/60 backdrop-blur-xl shadow-sm space-y-4">
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
                        GATEWAY
                      </div>
                      <div>
                        <p className="text-xs font-mono font-semibold text-white">Razorpay Secure Checkout</p>
                        <p className="text-[11px] font-mono text-neutral-500">Cryptographically signed order verification</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-neutral-300 border border-white/10 self-start sm:self-auto">
                      Active Channel
                    </span>
                  </div>
                </div>
              )}

              {/* Real Invoices & Receipts History */}
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-sf-121417/60 backdrop-blur-xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-base font-bold text-white">Billing History & Receipts</h2>
                  <span className="text-xs font-mono text-neutral-500">
                    {historyItems.length} {historyItems.length === 1 ? 'Receipt' : 'Receipts'}
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-zinc-500 font-mono text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-copper-400" />
                    <span>Loading payment history...</span>
                  </div>
                ) : historyError ? (
                  <div className="py-6 text-center text-red-400/80 font-mono text-xs space-y-1">
                    <p>{historyError}</p>
                    <p className="text-[11px] text-zinc-500">Refresh to try fetching records again.</p>
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 font-mono text-xs space-y-2">
                    <p>No payment records found.</p>
                    <p className="text-[11px] text-zinc-600">
                      {isFree ? 'You are currently on the Free tier.' : 'Your paid subscription receipts will display here once verified.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 font-mono text-xs">
                    {historyItems.map((inv) => {
                      const dateStr = new Date(inv.paidAt || inv.orderedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                      const displayAmount = formatAmount(inv.amountPaise, inv.currency);

                      return (
                        <div 
                          key={inv.orderId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-white truncate max-w-[200px] sm:max-w-[260px]">
                                {inv.orderId}
                              </p>
                              <p className="text-[11px] text-neutral-500">
                                {inv.planName} · {dateStr}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 justify-between sm:justify-end">
                            <span className="font-bold text-white">{displayAmount}</span>
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {inv.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(inv)}
                              className="text-[11px] text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                            >
                              View Receipt
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Order Receipt Breakdown Card */}
            <div className="space-y-6">
              <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-sf-121417/80 backdrop-blur-xl shadow-sm space-y-5">
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
                    <span>Account Holder</span>
                    <span className="text-white font-medium">{profile?.name || 'Prompt Architect'}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Email</span>
                    <span className="text-white font-medium truncate max-w-[150px]">{profile?.email || 'user@example.com'}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Status</span>
                    <span className={cn(
                      "font-medium", 
                      isExpired ? "text-amber-400" : isFree ? "text-copper-400" : "text-emerald-400"
                    )}>
                      {isExpired ? 'Pass Expired' : isFree ? 'Free Tier' : 'Active Pass'}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>{planDisplayName} (30 Days)</span>
                    <span className="text-white font-medium">
                      {isFree ? '₹0.00' : `${planPrice.symbol}${planPrice.base}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Tax (GST)</span>
                    <span className="text-white font-medium">
                      {isFree ? '₹0.00' : `${planPrice.symbol}${planPrice.gst}`}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="flex justify-between items-baseline font-mono">
                  <span className="text-sm font-semibold text-white">
                    {isFree ? 'Current Rate' : 'Total'}
                  </span>
                  <span className="text-2xl font-bold text-white">
                    {isFree ? '₹0.00' : `${planPrice.symbol}${planPrice.total}`}
                  </span>
                </div>

                <div className="pt-2 space-y-3">
                  {isFree || isExpired ? (
                    <Link
                      to="/app/pricing"
                      className="w-full py-2.5 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-semibold text-xs font-mono uppercase tracking-wider transition-colors shadow-md shadow-copper-500/20 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isExpired ? 'Renew Access Pass' : 'Upgrade Plan'}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs font-mono uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                    >
                      Print Summary
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

              {/* Corporate Receipts Note */}
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] text-xs font-mono text-neutral-400 space-y-2">
                <p className="text-white font-semibold">Payment Receipts & Invoicing</p>
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Confirmed payments are verified with cryptographic HMAC-SHA256 signatures. Invoices reflect your chosen billing currency (INR or USD).
                </p>
                <Link to="/app/settings" className="inline-block text-[11px] text-copper-400 hover:text-copper-300 pt-1">
                  Manage Workspace Profile &rarr;
                </Link>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* View Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-sf-121417 border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative font-sans text-white">
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Payment Confirmed
                </span>
              </div>
              <h3 className="text-2xl font-bold font-editorial">Official Payment Receipt</h3>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Bedrock Prompt Architecture Engine
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 font-mono text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Order Reference</span>
                <span className="text-white font-semibold">{selectedReceipt.orderId}</span>
              </div>
              {selectedReceipt.paymentId && (
                <div className="flex justify-between text-neutral-400">
                  <span>Razorpay Payment ID</span>
                  <span className="text-white">{selectedReceipt.paymentId}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-400">
                <span>Date & Time</span>
                <span className="text-white">
                  {new Date(selectedReceipt.paidAt || selectedReceipt.orderedAt).toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Subscription Plan</span>
                <span className="text-white font-medium">{selectedReceipt.planName} · 30 Days</span>
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs border-t border-b border-white/10 py-3">
              <div className="flex justify-between text-neutral-400">
                <span>Base Price</span>
                <span className="text-white">
                  {formatAmount(selectedReceipt.basePaise, selectedReceipt.currency)}
                </span>
              </div>
              {selectedReceipt.currency === 'INR' && (
                <div className="flex justify-between text-neutral-400">
                  <span>GST (18%)</span>
                  <span className="text-white">
                    {formatAmount(selectedReceipt.gstPaise, selectedReceipt.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white pt-1">
                <span>Total Charged</span>
                <span className="text-emerald-400">
                  {formatAmount(selectedReceipt.amountPaise, selectedReceipt.currency)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-white text-black font-mono text-xs font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-mono text-xs hover:bg-white/15 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
