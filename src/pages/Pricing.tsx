import { useRef, useState } from 'react';
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
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';
import { useUserProfile, syncRemoteUserProfile } from '../lib/useUserProfile';
import { normalizeTier } from '../lib/subscriptionTiers';
import { startRazorpayCheckout } from '../lib/razorpay';

const SUPPORT_EMAIL = 'bedrockofficialpage@gmail.com';

interface PricingTier {
  name: string;
  slug: 'free' | 'pro' | 'advanced' | 'ultimate';
  description: string;
  price: string;
  gstPrice: string;
  totalPrice: string;
  features: { text: string; active: boolean; bold?: boolean }[];
  isPopular?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Zero-cost frontier exploration with core daily limits',
    price: '0',
    gstPrice: '0',
    totalPrice: '0',
    features: [
      { text: 'Core Gemini 3.5 Flash Lite & Groq Qwen 27B', active: true },
      { text: '10 prompt generations per day', active: true },
      { text: '3 DAG canvas pipeline nodes', active: true },
      { text: 'Up to 5 custom prompt library slots', active: true },
      { text: 'Local Ollama & OpenRouter Free models', active: true },
      { text: 'Claude 3.5 Sonnet & Haiku access', active: false },
      { text: 'GPT-4o & OpenAI frontier reasoning models', active: false },
      { text: 'Automated assertion & rubric scoring', active: false },
    ],
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Uncapped prompts, frontier Pro models, and extended DAG architectures',
    price: '399',
    gstPrice: '71.82',
    totalPrice: '470.82',
    isPopular: true,
    features: [
      { text: 'Unlimited daily prompt generations ($0 marginal cost)', active: true, bold: true },
      { text: 'GPT-4o Mini & Claude 3.5 Haiku frontier models', active: true },
      { text: 'Llama 3.3 70B & Mistral Large 2411', active: true },
      { text: '15 DAG canvas pipeline nodes with branching logic', active: true },
      { text: 'Up to 100 library prompt templates with tags', active: true },
      { text: 'Export to .cursorrules & production system prompts', active: true },
      { text: 'Zero queue delays & priority inference dispatch', active: true },
      { text: 'Claude 3.5 Sonnet Flagship & o3-mini access', active: false },
    ],
  },
  {
    name: 'Ultimate',
    slug: 'ultimate',
    description: 'State-of-the-art frontier intelligence for principal prompt engineers',
    price: '999',
    gstPrice: '179.82',
    totalPrice: '1,178.82',
    features: [
      { text: 'Everything in Pro, plus:', active: true, bold: true },
      { text: 'Claude 3.5 Sonnet (20241022) & GPT-4o Flagship', active: true, bold: true },
      { text: 'o3-mini & OpenAI reasoning models', active: true },
      { text: 'Perplexity Sonar Pro & xAI Grok-3 models', active: true },
      { text: 'Unlimited DAG pipeline nodes & infinite canvas branches', active: true },
      { text: 'Automated assertion evals & quality rubric judge', active: true },
      { text: 'Unlimited prompt library templates & multi-export formats', active: true },
      { text: 'VIP low-latency queue & lifetime execution traces', active: true },
    ],
  }
];

export default function Pricing() {
  const { profile, updateProfile } = useUserProfile();
  const currentTier = normalizeTier(profile?.plan);
  const navigate = useNavigate();

  const [checkoutTier, setCheckoutTier] = useState<PricingTier | null>(null);
  const [purchasedTier, setPurchasedTier] = useState<PricingTier | null>(null);
  const [billingName, setBillingName] = useState(profile?.name || 'Prompt Architect');
  const [billingEmail, setBillingEmail] = useState(profile?.email || 'user@example.com');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Messages about the payment itself. They live on the page (not inside the confirmation window), because that
  // window closes as soon as Razorpay opens, and a declined, cancelled or unconfirmed payment must never go unnoticed.
  const [paymentNotice, setPaymentNotice] = useState<{ kind: 'error' | 'pending' | 'info'; title: string; message: string } | null>(null);
  const razorpayOpenRef = useRef(false);
  const paymentDoneRef = useRef(false);

  const handleOpenCheckout = (tier: PricingTier) => {
    if (tier.slug === 'free') return;
    setBillingName(profile?.name || 'Prompt Architect');
    setBillingEmail(profile?.email || '');
    setErrorMessage(null);
    setPaymentNotice(null);
    setPaymentSuccess(false);
    setCheckoutTier(tier);
  };

  const handleConfirmPayment = async () => {
    if (!checkoutTier) return;
    if (!billingEmail || !billingEmail.includes('@')) {
      setErrorMessage('Please provide a valid email address to receive your payment confirmation and tax invoice.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setPaymentNotice(null);
    razorpayOpenRef.current = false;
    paymentDoneRef.current = false;

    const targetPlanName = checkoutTier.slug === 'ultimate' ? 'Ultimate Plan' : 'Pro Plan';
    // totalPrice is display text such as '1,178.82': parseFloat stops at the comma (it read 1, so Ultimate was
    // offered for 100 paise). The server sets the real price; this only lets it check what the user was shown.
    const amountInPaise = Math.round(parseFloat(checkoutTier.totalPrice.replace(/,/g, '')) * 100);
    setPurchasedTier(checkoutTier);

    try {
      await startRazorpayCheckout({
        tier: checkoutTier.slug,
        planName: targetPlanName,
        amount: amountInPaise,
        currency: 'INR',
        userName: billingName,
        userEmail: billingEmail,
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
      <div className="w-full px-4 sm:px-8 py-12 lg:py-16 min-h-screen bg-[#050505] text-white">
        
        {/* Header */}
        <div className="text-center mb-16">
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
          {TIERS.map((tier) => {
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
                    ? "bg-sf-14181a/70 border-copper-500/40 shadow-2xl shadow-copper-500/10" 
                    : "bg-sf-0c0e14/70 border-white/10 hover:border-white/20 hover:bg-sf-111111"
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

                <div className="mb-6 flex items-baseline gap-1 font-mono">
                  <span className="text-4xl font-bold text-white tracking-tight">₹{tier.price}</span>
                  <span className={cn("text-xs uppercase tracking-wider", tier.isPopular ? "text-gray-400" : "text-gray-500")}>
                    / month
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleOpenCheckout(tier)}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all mb-8 shadow-sm flex items-center justify-center gap-2",
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
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg rounded-3xl bg-sf-0c0e14/95 border border-white/15 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white font-sans overflow-hidden"
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
                <div className="space-y-5">
                  {/* Customer Information */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-copper-400" />
                      <span>Account Holder Name</span>
                    </label>
                    <input
                      type="text"
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-copper-500/60 font-sans"
                    />

                    <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 pt-1">
                      <Mail className="w-3 h-3 text-copper-400" />
                      <span>Confirmation & Invoice Email</span>
                    </label>
                    <input
                      type="email"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-copper-500/60 font-sans"
                    />
                  </div>

                  {/* Order Line Items */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>{checkoutTier.name} Subscription (Monthly)</span>
                      <span className="text-white font-semibold">₹{checkoutTier.price}.00</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>GST (18% SGST/CGST)</span>
                      <span className="text-white font-semibold">₹{checkoutTier.gstPrice}</span>
                    </div>
                    <div className="h-px bg-white/10 pt-1" />
                    <div className="flex justify-between items-baseline text-sm pt-1">
                      <span className="font-semibold text-white">Total Amount Due:</span>
                      <span className="text-xl font-bold text-copper-300">₹{checkoutTier.totalPrice}</span>
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
                        <span>Pay ₹{checkoutTier.totalPrice} with Razorpay</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-zinc-500 text-center font-mono">
                    Activated as soon as the payment is confirmed · Secure checkout by Razorpay
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
