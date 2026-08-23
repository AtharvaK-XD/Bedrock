import { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ShieldCheck, CreditCard, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageTransition } from '../components/layout/PageTransition';

// Shared texture style for realistic paper
const paperStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E")`,
  backgroundColor: '#f8f9fa',
  boxShadow: 'inset 0 0 40px rgba(0,0,0,0.015), 0 0 1px rgba(0,0,0,0.1)'
};

const ReceiptTop = ({ currentDate }: { currentDate: string }) => (
  <div className="w-[400px] h-[260px] relative pt-10 px-8 font-mono select-none overflow-hidden" style={paperStyle}>
    {/* Jagged top edge */}
    <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-transparent via-[#f8f9fa] to-transparent bg-[length:12px_12px]" style={{ backgroundImage: 'radial-gradient(circle at 6px 0, transparent 6px, #f8f9fa 6.5px)' }}/>
    
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-100 text-teal-600 mb-4 shadow-sm border border-teal-200/50">
        <CheckCircle2 className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold font-editorial tracking-tight text-black mb-1">Upgrade Successful</h2>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Order Receipt</p>
    </div>

    <div className="space-y-1.5 text-xs text-gray-600">
      <div className="flex justify-between">
        <span>Date</span>
        <span className="font-semibold text-black text-right">{currentDate}</span>
      </div>
      <div className="flex justify-between">
        <span>Order ID</span>
        <span className="font-semibold text-black">#BDRK-{Math.floor(100000 + Math.random() * 900000)}</span>
      </div>
      <div className="flex justify-between">
        <span>Account</span>
        <span className="font-semibold text-black">Atharva K.</span>
      </div>
    </div>
  </div>
);

const ReceiptMiddle = () => (
  <div className="w-[400px] h-[220px] relative py-6 px-8 font-mono select-none overflow-hidden border-t border-gray-200/50" style={paperStyle}>
    <div className="w-full h-[1px] bg-gray-300 mb-5 border-b border-dashed border-gray-400" />
    <div className="mb-5">
      <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-semibold">Subscription Detail</h3>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-lg text-black">Advanced Plan</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Billed monthly</p>
        </div>
        <p className="font-bold text-lg text-black">₹399.00</p>
      </div>
    </div>
    <div className="w-full h-[1px] bg-gray-300 mb-5 border-b border-dashed border-gray-400" />
    <div className="space-y-2 mb-2">
      <div className="flex justify-between text-xs text-gray-600">
        <span>Subtotal</span>
        <span className="text-black font-medium">₹399.00</span>
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>Tax (18% GST)</span>
        <span className="text-black font-medium">₹71.82</span>
      </div>
    </div>
  </div>
);

const ReceiptBottom = () => (
  <div className="w-[400px] h-[340px] relative pt-4 pb-12 px-8 font-mono select-none overflow-hidden border-t border-gray-200/50" style={paperStyle}>
    <div className="flex justify-between items-center mb-6 pt-2">
      <span className="font-bold text-gray-700 text-sm">Total Paid</span>
      <span className="font-bold text-2xl text-black">₹470.82</span>
    </div>

    <div className="bg-white p-4 rounded-xl flex items-center gap-3 mb-8 border border-gray-200 shadow-sm">
      <CreditCard className="w-5 h-5 text-gray-400" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-800">Visa ending in 4242</p>
        <p className="text-[10px] text-gray-500 mt-0.5">Authenticated via Stripe</p>
      </div>
      <ShieldCheck className="w-5 h-5 text-teal-500" />
    </div>

    {/* Barcode Mock */}
    <div className="flex justify-center mb-8 opacity-60">
        <div className="flex h-12 gap-[2px]">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="bg-black rounded-sm" style={{ width: `${Math.random() * 4 + 1}px` }} />
          ))}
        </div>
    </div>

    <div className="text-center space-y-5">
      <p className="text-[10px] text-gray-500 italic">Thank you for building with Bedrock.</p>
      <button className="flex items-center justify-center gap-2 w-full py-3 bg-[#111] text-white rounded-xl hover:bg-black transition-colors font-sans text-sm font-semibold shadow-md active:scale-[0.98]">
        <Download className="w-4 h-4" />
        Download PDF Receipt
      </button>
    </div>

    {/* Jagged bottom edge */}
    <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[length:24px_24px]" style={{
      background: 'linear-gradient(-45deg, transparent 16px, #f8f9fa 0), linear-gradient(45deg, transparent 16px, #f8f9fa 0)',
      backgroundRepeat: 'repeat-x',
      backgroundSize: '24px 24px',
      backgroundPosition: 'left bottom'
    }}/>
  </div>
);

export default function Billing() {
  const [currentDate, setCurrentDate] = useState('');
  const controls = useAnimation();

  useEffect(() => {
    const date = new Date();
    setCurrentDate(date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }));
  }, []);

  useEffect(() => {
    // Sequence the unfolding animation
    const sequence = async () => {
      await controls.start("unfold");
      controls.start("float");
    };
    sequence();
  }, [controls]);

  // Spring configurations for realistic paper snapping
  const paperSpring = { type: "spring" as const, damping: 15, stiffness: 60, mass: 1 };
  
  return (
    <PageTransition>
      <div className="w-full min-h-[calc(100vh-80px)] py-4 flex flex-col items-center relative bg-[#0a0a0a] overflow-hidden">
        
        {/* Navigation overlay */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 absolute top-8 left-0 right-0 z-50">
          <Link to="/app/pricing" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group bg-black/50 px-5 py-2.5 rounded-full backdrop-blur-md border border-white/10 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Pricing
          </Link>
        </div>

        {/* 3D Scene Container */}
        <div 
          className="relative w-full h-full flex flex-col items-center pt-24 pb-32" 
          style={{ perspective: '1600px', transformStyle: 'preserve-3d' }}
        >
          
          {/* Printer Slot Graphic */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-8 bg-gradient-to-b from-[#111] to-[#0a0a0a] rounded-b-3xl border-x border-b border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-20">
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[92%] h-[6px] bg-black rounded-full shadow-[inset_0_3px_6px_rgba(0,0,0,1)]" />
            <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 w-[85%] h-[30px] bg-teal-500/10 blur-[25px] pointer-events-none" />
          </div>

          {/* Root Group (Top Segment) */}
          <motion.div
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ y: -100, rotateX: 60, rotateZ: -5, opacity: 0 }}
            variants={{
              unfold: { 
                y: 0, 
                rotateX: 10, // Slight tilt forward
                rotateZ: 0, 
                opacity: 1,
                transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] }
              },
              float: {
                y: [0, -10, 0],
                rotateX: [10, 12, 10],
                rotateY: [-2, 2, -2],
                transition: { duration: 6, repeat: Infinity, ease: "easeInOut" }
              }
            }}
            animate={controls}
            className="relative z-10 drop-shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
          >
            <ReceiptTop currentDate={currentDate} />

            {/* Middle Hinge */}
            <motion.div
              className="absolute top-full left-0 w-full"
              style={{ transformOrigin: 'top', transformStyle: 'preserve-3d' }}
              initial={{ rotateX: -160 }}
              variants={{
                unfold: { 
                  rotateX: 0, 
                  transition: { delay: 0.3, ...paperSpring }
                }
              }}
              animate={controls}
            >
              <ReceiptMiddle />
              
              {/* Dynamic Shadow (Ambient Occlusion) for Middle Fold */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"
                initial={{ opacity: 1 }}
                variants={{ unfold: { opacity: 0, transition: { delay: 0.3, duration: 1 } } }}
                animate={controls}
              />

              {/* Bottom Hinge */}
              <motion.div
                className="absolute top-full left-0 w-full"
                style={{ transformOrigin: 'top', transformStyle: 'preserve-3d' }}
                initial={{ rotateX: 160 }}
                variants={{
                  unfold: { 
                    rotateX: 0, 
                    transition: { delay: 0.6, ...paperSpring }
                  }
                }}
                animate={controls}
              >
                <ReceiptBottom />
                
                {/* Dynamic Shadow (Ambient Occlusion) for Bottom Fold */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"
                  initial={{ opacity: 1 }}
                  variants={{ unfold: { opacity: 0, transition: { delay: 0.6, duration: 1 } } }}
                  animate={controls}
                />
              </motion.div>
            </motion.div>
          </motion.div>
          
        </div>
      </div>
    </PageTransition>
  );
}
