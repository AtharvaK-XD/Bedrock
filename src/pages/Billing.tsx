import { motion } from 'framer-motion';
import { PageTransition } from '../components/layout/PageTransition';
import { ArrowLeft, CheckCircle2, ShieldCheck, CreditCard, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Billing() {
  const [currentDate, setCurrentDate] = useState('');

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

  // Animation variants
  const receiptContainer = {
    hidden: { 
      opacity: 0, 
      y: -100, 
      scaleY: 0,
      transformOrigin: 'top'
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      scaleY: 1,
      transition: { 
        duration: 0.8, 
        ease: [0.22, 1, 0.36, 1],
        when: "beforeChildren",
        staggerChildren: 0.1
      } 
    }
  };

  const itemVariant = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  const lineVariant = {
    hidden: { scaleX: 0 },
    visible: { scaleX: 1, transition: { duration: 0.6, ease: "easeInOut" } }
  };

  return (
    <PageTransition>
      <div className="w-full min-h-[calc(100vh-80px)] py-12 px-4 sm:px-8 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md mx-auto z-10">
          
          <Link to="/app/pricing" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Pricing
          </Link>

          {/* Printer Slot Graphic */}
          <div className="w-full h-4 bg-[#111] rounded-t-xl border-x border-t border-white/10 shadow-inner overflow-hidden relative z-20">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[2px] bg-black/80 rounded-full shadow-[0_0_10px_rgba(0,0,0,1)]" />
          </div>

          {/* The Receipt */}
          <motion.div 
            variants={receiptContainer}
            initial="hidden"
            animate="visible"
            className="bg-[#f8f9fa] text-gray-900 rounded-b-sm shadow-2xl relative pt-8 pb-12 px-8 font-mono"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)'
            }}
          >
            {/* Top jagged edge decoration */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-[#f8f9fa] to-transparent bg-[length:10px_10px]" style={{
              backgroundImage: 'radial-gradient(circle at 5px 0, transparent 5px, #f8f9fa 5.5px)'
            }}/>

            <motion.div variants={itemVariant} className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-100 text-teal-600 mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold font-editorial tracking-tight text-black mb-1">Upgrade Successful</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Order Receipt</p>
            </motion.div>

            <motion.div variants={itemVariant} className="space-y-1 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold">{currentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order ID</span>
                <span className="font-semibold">#BDRK-{Math.floor(100000 + Math.random() * 900000)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Account</span>
                <span className="font-semibold">Atharva K.</span>
              </div>
            </motion.div>

            <motion.div variants={lineVariant} className="w-full h-[1px] bg-gray-300 mb-6 origin-left border-b border-dashed border-gray-400" />

            <motion.div variants={itemVariant} className="mb-6">
              <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Subscription Detail</h3>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-lg text-black">Advanced Plan</p>
                  <p className="text-xs text-gray-500">Billed monthly</p>
                </div>
                <p className="font-bold text-lg text-black">₹399.00</p>
              </div>
            </motion.div>

            <motion.div variants={lineVariant} className="w-full h-[1px] bg-gray-300 mb-6 origin-left border-b border-dashed border-gray-400" />

            <motion.div variants={itemVariant} className="space-y-2 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>₹399.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (18% GST)</span>
                <span>₹71.82</span>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                <span className="font-bold text-gray-700">Total Paid</span>
                <span className="font-bold text-2xl text-black">₹470.82</span>
              </div>
            </motion.div>

            <motion.div variants={itemVariant} className="bg-gray-100 p-4 rounded-lg flex items-center gap-3 mb-8">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Visa ending in 4242</p>
                <p className="text-xs text-gray-500">Authenticated via Stripe</p>
              </div>
              <ShieldCheck className="w-5 h-5 text-teal-600" />
            </motion.div>

            {/* Barcode Mock */}
            <motion.div variants={itemVariant} className="flex justify-center mb-6 opacity-60">
               <div className="flex h-12 gap-[2px]">
                 {[...Array(40)].map((_, i) => (
                   <div key={i} className="bg-black" style={{ width: `${Math.random() * 4 + 1}px` }} />
                 ))}
               </div>
            </motion.div>

            <motion.div variants={itemVariant} className="text-center space-y-4">
              <p className="text-xs text-gray-500">Thank you for building with Bedrock.</p>
              
              <button className="flex items-center justify-center gap-2 w-full py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors font-sans text-sm font-semibold">
                <Download className="w-4 h-4" />
                Download PDF Receipt
              </button>
            </motion.div>

            {/* Bottom jagged edge */}
            <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[length:20px_20px]" style={{
              background: 'linear-gradient(-45deg, transparent 16px, #f8f9fa 0), linear-gradient(45deg, transparent 16px, #f8f9fa 0)',
              backgroundRepeat: 'repeat-x',
              backgroundSize: '20px 20px',
              backgroundPosition: 'left bottom'
            }}/>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
