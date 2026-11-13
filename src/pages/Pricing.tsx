import { useRef, useState, useMemo } from 'react';
import { useDialogBehavior } from '../lib/useDialogBehavior';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  ArrowRight, 
  CreditCard,
  Mail,
  User,
  Zap,
  AlertTriangle,
  Info,
  Globe,
  MapPin,
  Phone
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';
import { useUserProfile, syncRemoteUserProfile } from '../lib/useUserProfile';
import { normalizeTier } from '../lib/subscriptionTiers';
import { startRazorpayCheckout } from '../lib/razorpay';
import { getPlanPrice, type BillingCurrency } from '../lib/pricing';

const SUPPORT_EMAIL = 'bedrockofficialpage@gmail.com';

interface PricingTier {
  name: string;
  slug: 'free' | 'pro' | 'advanced' | 'ultimate';
  description: string;
  price: string;
  symbol: string;
  subtext?: string;
  gstPrice: string;
  totalPrice: string;
  features: { text: string; active: boolean; bold?: boolean }[];
  isPopular?: boolean;
}

export default function Pricing() {
  const { profile, updateProfile } = useUserProfile();
  const currentTier = normalizeTier(profile?.plan);
  const navigate = useNavigate();

  const [currency, setCurrency] = useState<BillingCurrency>('USD');
  const [checkoutTier, setCheckoutTier] = useState<PricingTier | null>(null);
  const [purchasedTier, setPurchasedTier] = useState<PricingTier | null>(null);
  const [billingName, setBillingName] = useState(profile?.name || 'Prompt Architect');
  const [billingEmail, setBillingEmail] = useState(profile?.email || 'user@example.com');
  const [billingAddress, setBillingAddress] = useState(profile?.location || '');
  const [billingPhone, setBillingPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Messages about the payment itself. They live on the page (not inside the confirmation window), because that
  // window closes as soon as Razorpay opens, and a declined, cancelled or unconfirmed payment must never go unnoticed.
  const [paymentNotice, setPaymentNotice] = useState<{ kind: 'error' | 'pending' | 'info'; title: string; message: string } | null>(null);
  const razorpayOpenRef = useRef(false);
  const paymentDoneRef = useRef(false);
  const checkoutDialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(
    checkoutDialogRef,
    Boolean(checkoutTier || paymentSuccess),
    // Escape closes the window unless a payment is being started or has just succeeded
    checkoutTier && !isProcessing && !paymentSuccess ? () => setCheckoutTier(null) : undefined
  );

  const tiers: PricingTier[] = useMemo(() => [
    {
      name: 'Free',
      slug: 'free',
      description: 'Zero-cost frontier exploration with core daily limits',
      price: '0',
      symbol: currency === 'USD' ? '$' : '₹',
      subtext: 'Free forever · No credit card required',
      gstPrice: '0',
      totalPrice: '0',
      features: [
        { text: 'Core Gemini 3.5 Flash Lite & Groq GPT-OSS 120B', active: true },
        { text: '10 prompt generations per day', active: true },
        { text: '5 DAG canvas pipeline nodes', active: true },
        { text: 'Up to 5 custom prompt library slots', active: true },
        { text: 'Local Ollama & OpenRouter Free models', active: true },
        { text: 'Claude Sonnet 5.5 & GPT-6.1 Sol access', active: false },
        { text: 'DeepSeek R1 & o3-mini reasoning models', active: false },
        { text: 'Automated assertion & rubric scoring', active: false },
      ],
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'Uncapped prompts, frontier Pro models, and extended DAG architectures',
      price: getPlanPrice('pro', currency).base,
      symbol: getPlanPrice('pro', currency).symbol,
      subtext: currency === 'USD' 
        ? '$20 USD · 30-day access pass · No auto-renew' 
        : '₹1,700 · 30-day access pass · No auto-renew · UPI & Cards',
      gstPrice: getPlanPrice('pro', currency).gst,
      totalPrice: getPlanPrice('pro', currency).total,
      isPopular: true,
      features: [
        { text: 'Unlimited daily prompt generations ($0 marginal cost)', active: true, bold: true },
        { text: 'Claude Sonnet 5.5 & GPT-6.1 Sol / Luna frontier models', active: true, bold: true },
        { text: 'o3-mini, DeepSeek R1 & Grok 4.7 reasoning', active: true },
        { text: 'Llama 3.3 70B, Gemini 3.6 Flash & Mistral Large 2411', active: true },
        { text: '10 DAG canvas pipeline nodes with branching logic', active: true },
        { text: 'Up to 100 library prompt templates with tags', active: true },
        { text: 'Export to .cursorrules & production system prompts', active: true },
        { text: 'Zero queue delays & priority inference dispatch', active: true },
        { text: 'Claude Opus 5.5, GPT-6 Astra & OpenAI o1 access', active: false },
      ],
    },
    {
      name: 'Ultimate',
      slug: 'ultimate',
      description: 'State-of-the-art frontier intelligence for principal prompt engineers',
      price: getPlanPrice('ultimate', currency).base,
      symbol: getPlanPrice('ultimate', currency).symbol,
      subtext: currency === 'USD' 
        ? '$50 USD · 30-day access pass · No auto-renew' 
        : '₹4,250 · 30-day access pass · No auto-renew · UPI & Cards',
      gstPrice: getPlanPrice('ultimate', currency).gst,
      totalPrice: getPlanPrice('ultimate', currency).total,
      features: [
        { text: 'Everything in Pro, plus:', active: true, bold: true },
        { text: 'Claude Opus 5.5, GPT-6 Astra & OpenAI o1 Flagships', active: true, bold: true },
        { text: 'Gemini 4 Argon (1M+ Context) & Llama 3.1 405B Giant', active: true, bold: true },
        { text: 'Perplexity Sonar Reasoning Pro (Chain-of-Thought Search)', active: true },
        { text: '20 DAG canvas pipeline nodes & infinite canvas branches', active: true },
        { text: 'Automated assertion evals & quality rubric judge', active: true },
        { text: 'Unlimited prompt library templates & multi-export formats', active: true },
        { text: 'VIP low-latency queue & lifetime execution traces', active: true },
      ],
    }
  ], [currency]);

  const handleOpenCheckout = (tier: PricingTier) => {
    if (tier.slug === 'free') return;
    setBillingName(profile?.name || 'Prompt Architect');
    const rawEmail = profile?.email || '';
    const cleanEmail = rawEmail.endsWith('@clerk.user') || rawEmail.startsWith('user_') ? '' : rawEmail;
    setBillingEmail(cleanEmail);
    setBillingAddress(profile?.location || '');
    setBillingPhone('');
    setErrorMessage(null);
    setPaymentNotice(null);
    setPaymentSuccess(false);
    setCheckoutTier(tier);
  };

  const handleConfirmPayment = async () => {
    if (!checkoutTier) return;
    if (!billingName || !billingName.trim()) {
      setErrorMessage('Please provide your full account holder name.');
      return;
    }
    if (!billingEmail || !billingEmail.includes('@') || billingEmail.endsWith('@clerk.user')) {
      setErrorMessage('Please provide a valid email address to receive your payment confirmation and tax invoice.');
      return;
    }
    if (!billingAddress || !billingAddress.trim()) {
      setErrorMessage('Please provide your billing address for official tax invoice generation.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setPaymentNotice(null);
    razorpayOpenRef.current = false;
    paymentDoneRef.current = false;

    const targetPlanName = checkoutTier.slug === 'ultimate' ? 'Ultimate Plan' : 'Pro Plan';
    const planPrice = getPlanPrice(checkoutTier.slug === 'ultimate' ? 'ultimate' : 'pro', currency);
    const amountSubunits = planPrice.totalSubunits;
    setPurchasedTier(checkoutTier);

    try {
      await startRazorpayCheckout({
        tier: checkoutTier.slug,
        planName: targetPlanName,
        amount: amountSubunits,
        currency,
        userName: billingName,
        userEmail: billingEmail,
        userPhone: billingPhone || undefined,
        userAddress: billingAddress || undefined,
        onOpen: () => {
          razorpayOpenRef.current = true;
          // Dismiss the intermediate Bedrock confirmation modal so Razorpay floats cleanly above Bedrock
          setCheckoutTier(null);
          setIsProcessing(false);
        },
        onSuccess: (_verifyResult) => {
          paymentDoneRef.current = true;
          // Take the plan from the server (it is the source of truth), then keep the local copy in step
          syncRemoteUserProfile().catch(() => {});
          updateProfile({
            name: billingName,
            email: billingEmail,
            plan: targetPlanName,
            location: billingAddress,
          });

          setPaymentSuccess(true);
          setTimeout(() => {
            setIsProcessing(false);
            setPurchasedTier(null);
            navigate('/app/billing');
          }, 2000);
        },
        onError: (err) => {
          setIsProcessing(false);
          const text = err || 'Payment processing failed. Please try again.';
          if (razorpayOpenRef.current) {
            // The confirmation window is already closed: show the reason on the page
            setPaymentNotice({
              kind: 'error',
              title: 'Payment did not go through',
              message: `${text} You have not been charged for a failed payment. You can try again whenever you are ready.`,
            });
          } else {
            setErrorMessage(text);
          }
        },
        onVerificationFailed: ({ message, paymentId }) => {
          setIsProcessing(false);
          paymentDoneRef.current = true;
          setPaymentNotice({
            kind: 'pending',
            title: 'Your payment went through, but we could not activate your plan yet',
            message: `Please do not pay again. Your payment reference is ${paymentId}. Your plan should update on its own shortly; if it has not within a few minutes, email ${SUPPORT_EMAIL} with that reference and we will fix it. (${message})`,
          });
          // Ask the server again: the payment may already be recorded
          syncRemoteUserProfile().catch(() => {});
        },
        onDismiss: () => {
          setIsProcessing(false);
          if (!paymentDoneRef.current) {
            setPaymentNotice({
              kind: 'info',
              title: 'Payment cancelled',
              message: 'No payment was taken. You can start again from any plan below.',
            });
          }
        },
      });
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Failed to initiate Razorpay checkout.');
    }
  };

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-12 lg:py-16 min-h-screen bg-black text-white">
        
        {/* Header */}
        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-editorial font-bold text-white mb-4 tracking-tight"
          >
            Upgrade your plan.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto font-light"
          >
            Predictable flat-rate pricing for high-throughput prompt engineering and multi-agent DAG pipelines.
          </motion.p>

          {/* Interactive Currency Switcher */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-center mt-8"
          >
            <div className="inline-flex items-center p-1.5 rounded-2xl bg-zinc-950/90 border border-white/10 backdrop-blur-xl shadow-2xl">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={cn(
                  "px-4 sm:px-5 py-2 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-2 cursor-pointer",
                  currency === 'USD'
                    ? "bg-copper-500 text-black font-bold shadow-lg shadow-copper-500/25"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>$ USD (International · Cards & Global)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                className={cn(
                  "px-4 sm:px-5 py-2 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-2 cursor-pointer",
                  currency === 'INR'
                    ? "bg-copper-500 text-black font-bold shadow-lg shadow-copper-500/25"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>₹ INR (India · UPI / RuPay)</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Payment status banner: stays visible after the Razorpay window closes */}
        <AnimatePresence>
          {paymentNotice && (
            <motion.div
              key={paymentNotice.title}
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(
                'max-w-3xl mx-auto mb-10 flex items-start gap-3 rounded-2xl border p-4 text-sm',
                paymentNotice.kind === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-100',
                paymentNotice.kind === 'pending' && 'border-amber-500/30 bg-amber-500/10 text-amber-100',
                paymentNotice.kind === 'info' && 'border-white/15 bg-white/[0.04] text-gray-200'
              )}
            >
              {paymentNotice.kind === 'info' ? (
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{paymentNotice.title}</p>
                <p className="text-xs leading-relaxed opacity-90">{paymentNotice.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentNotice(null)}
                aria-label="Dismiss payment message"
                className="shrink-0 cursor-pointer opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {tiers.map((tier) => {
            const isCurrent = 
              (tier.slug === 'free' && currentTier === 'free') ||
              ((tier.slug === 'pro' || tier.slug === 'advanced') && currentTier === 'pro') ||
              (tier.slug === 'ultimate' && currentTier === 'ultimate');

            return (
              <motion.div
                key={tier.name}
                whileHover={{ y: -4 }}
                className={cn(
                  "relative flex flex-col p-8 rounded-3xl border transition-all duration-300",
                  tier.isPopular 
                    ? "bg-black/90 border-copper-500/50 shadow-2xl shadow-copper-500/10 backdrop-blur-xl" 
                    : "bg-black/75 border-white/10 hover:border-white/25 hover:bg-black/90 backdrop-blur-xl"
                )}
              >
                {tier.isPopular && (
                  <div className="absolute top-6 right-6">
                    <span className="bg-copper-500/15 text-copper-300 text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-copper-500/30">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6 mt-2">
                  <h3 className="text-2xl font-bold font-display mb-2">{tier.name}</h3>
                  <p className={cn("text-xs leading-relaxed min-h-[36px]", tier.isPopular ? "text-gray-300" : "text-gray-400")}>
                    {tier.description}
                  </p>
                </div>

                <div className="mb-2 flex items-baseline gap-1 font-mono">
                  <span className="text-4xl font-bold text-white tracking-tight">{tier.symbol}{tier.price}</span>
                  <span className={cn("text-xs uppercase tracking-wider", tier.isPopular ? "text-gray-400" : "text-gray-500")}>
                    / 30 days
                  </span>
                </div>

                {tier.subtext && (
                  <p className="text-[11px] font-mono text-zinc-400 mb-6">
                    {tier.subtext}
                  </p>
                )}

                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleOpenCheckout(tier)}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all mb-8 shadow-sm flex items-center justify-center gap-2 cursor-pointer",
                    isCurrent
                      ? "bg-white/5 border border-white/10 text-zinc-500 cursor-default"
                      : tier.isPopular
                        ? "bg-copper-500 hover:bg-copper-400 text-black font-bold shadow-lg shadow-copper-500/25 active:scale-[0.98]"
                        : "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                  )}
                >
                  {isCurrent ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-copper-400" />
                      <span>Current Active Plan</span>
                    </>
                  ) : (
                    <>
                      <span>Upgrade to {tier.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="flex-1">
                  <ul className="space-y-3.5">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs">
                        <span className={cn(
                          "font-mono text-xs select-none shrink-0",
                          feature.active 
                            ? (tier.isPopular ? "text-copper-400 font-bold" : "text-emerald-400 font-bold") 
                            : "text-gray-600 opacity-40"
                        )}>
                          {feature.active ? "—" : "·"}
                        </span>
                        <span className={cn(
                          feature.bold && "font-semibold text-white",
                          !feature.active ? "text-gray-600 line-through opacity-40 font-mono" : "text-gray-300 font-sans"
                        )}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>

      {/* CHECKOUT & SUCCESS MODAL */}
      <AnimatePresence>
        {(checkoutTier || paymentSuccess) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
            <motion.div
              ref={checkoutDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={paymentSuccess ? 'Payment confirmed' : 'Confirm subscription'}
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl bg-black/95 border border-white/15 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white font-sans"
            >
              {/* Top ambient glow */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-copper-400 to-transparent" />
              <div className="absolute -top-24 -right-24 w-52 h-52 bg-copper-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-copper-500/15 border border-copper-500/30 flex items-center justify-center text-copper-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-white">
                      {paymentSuccess ? 'Payment Confirmed' : 'Confirm Subscription'}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-400">
                      {paymentSuccess ? 'Account Upgraded Instantly' : 'Cryptographically Secured Checkout'}
                    </p>
                  </div>
                </div>
                {!paymentSuccess && (
                  <button
                    type="button"
                    aria-label="Close checkout modal"
                    onClick={() => setCheckoutTier(null)}
                    disabled={isProcessing}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {paymentSuccess ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                    <Check className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white font-display">Payment Confirmed!</h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      Your workspace has been upgraded to the <span className="text-white font-semibold">{(purchasedTier || checkoutTier)?.name} Plan</span>.
                    </p>
                  </div>
                </div>
              ) : checkoutTier ? (
                <div className="space-y-4">
                  {/* Customer & Invoicing Details (Non-financial information) */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/[0.06] pb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-copper-400" />
                        <span>Customer & Invoicing Details</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-normal">Non-financial details only</span>
                    </div>

                    {/* Name & Email (2-Column Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                          <User className="w-3 h-3 text-copper-400" />
                          <span>Full Name</span>
                        </label>
                        <input
                          type="text"
                          value={billingName}
                          onChange={(e) => setBillingName(e.target.value)}
                          placeholder="Your Full Name"
                          className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-copper-500/60 font-sans"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                          <Mail className="w-3 h-3 text-copper-400" />
                          <span>Invoice Email</span>
                        </label>
                        <input
                          type="email"
                          value={billingEmail}
                          onChange={(e) => setBillingEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-copper-500/60 font-sans"
                        />
                      </div>
                    </div>

                    {/* Contact Phone (Optional) */}
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                        <Phone className="w-3 h-3 text-copper-400" />
                        <span>Phone <span className="text-zinc-500 normal-case">(optional, for SMS receipt)</span></span>
                      </label>
                      <input
                        type="tel"
                        value={billingPhone}
                        onChange={(e) => setBillingPhone(e.target.value)}
                        placeholder="+1... / +91..."
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-copper-500/60 font-sans"
                      />
                    </div>

                    {/* Billing Address */}
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3 h-3 text-copper-400" />
                        <span>Billing Address</span>
                      </label>
                      <input
                        type="text"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        placeholder="Street address, City, State / Postal Code, Country"
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-copper-500/60 font-sans"
                      />
                    </div>
                  </div>

                  {/* Order Line Items */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>{checkoutTier.name} Plan · 30-Day Access Pass</span>
                      <span className="text-white font-semibold">
                        {checkoutTier.symbol}{checkoutTier.price}.00
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Taxes & Gateway Processing</span>
                      <span className="text-emerald-400 font-semibold">Included (All-Inclusive)</span>
                    </div>
                    <div className="h-px bg-white/10 pt-1" />
                    <div className="flex justify-between items-baseline text-sm pt-1">
                      <span className="font-semibold text-white">Total Amount Due:</span>
                      <span className="text-xl font-bold text-copper-300">
                        {checkoutTier.symbol}{checkoutTier.totalPrice} <span className="text-xs text-zinc-400 font-normal">{currency}</span>
                      </span>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-mono">
                      {errorMessage}
                    </div>
                  )}

                  {/* Complete Payment Button */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleConfirmPayment}
                    className="w-full py-3.5 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-copper-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Opening Secure Razorpay Checkout...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Pay {checkoutTier.symbol}{checkoutTier.totalPrice} {currency} with Razorpay</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-zinc-500 text-center font-mono">
                    {currency === 'USD' 
                      ? 'Accepts all International Visa, Mastercard, Amex & Global Cards · Instant Activation'
                      : 'Supports all Indian UPI Apps (GPay, PhonePe, Paytm), RuPay & Cards · Instant Activation'}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
