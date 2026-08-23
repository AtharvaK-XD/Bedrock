import { Canvas } from '@react-three/fiber';
import { Html, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { useRef, useEffect, useState, Suspense } from 'react';
import gsap from 'gsap';
import { ArrowLeft, CheckCircle2, ShieldCheck, CreditCard, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { PageTransition } from '../components/layout/PageTransition';

// Shared texture style
const paperStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
  boxShadow: 'inset 0 0 40px rgba(0,0,0,0.02)'
};

const ReceiptTop = ({ currentDate }: { currentDate: string }) => (
  <div className="w-[380px] h-[250px] bg-[#f8f9fa] text-gray-900 relative pt-10 px-8 font-mono select-none overflow-hidden" style={paperStyle}>
    <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-transparent via-[#f8f9fa] to-transparent bg-[length:12px_12px]" style={{ backgroundImage: 'radial-gradient(circle at 6px 0, transparent 6px, #f8f9fa 6.5px)' }}/>
    
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-100 text-teal-600 mb-3 shadow-sm">
        <CheckCircle2 className="w-5 h-5" />
      </div>
      <h2 className="text-xl font-bold font-editorial tracking-tight text-black mb-1">Upgrade Successful</h2>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Order Receipt</p>
    </div>

    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-500">Date</span>
        <span className="font-semibold text-right max-w-[60%]">{currentDate}</span>
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-gray-500">Order ID</span>
        <span className="font-semibold">#BDRK-{Math.floor(100000 + Math.random() * 900000)}</span>
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-gray-500">Account</span>
        <span className="font-semibold">Atharva K.</span>
      </div>
    </div>
  </div>
);

const ReceiptMiddle = () => (
  <div className="w-[380px] h-[200px] bg-[#f8f9fa] text-gray-900 relative py-4 px-8 font-mono select-none overflow-hidden" style={paperStyle}>
    <div className="w-full h-[1px] bg-gray-300 mb-4 border-b border-dashed border-gray-400" />
    <div className="mb-4">
      <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Subscription Detail</h3>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-base text-black">Advanced Plan</p>
          <p className="text-[10px] text-gray-500">Billed monthly</p>
        </div>
        <p className="font-bold text-base text-black">₹399.00</p>
      </div>
    </div>
    <div className="w-full h-[1px] bg-gray-300 mb-4 border-b border-dashed border-gray-400" />
    <div className="space-y-1 mb-2">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Subtotal</span>
        <span>₹399.00</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Tax (18% GST)</span>
        <span>₹71.82</span>
      </div>
    </div>
  </div>
);

const ReceiptBottom = () => (
  <div className="w-[380px] h-[320px] bg-[#f8f9fa] text-gray-900 relative pt-2 pb-12 px-8 font-mono select-none overflow-hidden" style={paperStyle}>
    <div className="flex justify-between items-center mb-6 pt-4 border-t border-gray-200">
      <span className="font-bold text-gray-700 text-sm">Total Paid</span>
      <span className="font-bold text-xl text-black">₹470.82</span>
    </div>

    <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-3 mb-6 border border-gray-200 shadow-sm">
      <CreditCard className="w-4 h-4 text-gray-500" />
      <div className="flex-1">
        <p className="text-xs font-semibold">Visa ending in 4242</p>
        <p className="text-[10px] text-gray-500">Authenticated via Stripe</p>
      </div>
      <ShieldCheck className="w-4 h-4 text-teal-600" />
    </div>

    <div className="flex justify-center mb-6 opacity-70">
        <div className="flex h-10 gap-[2px]">
          {[...Array(45)].map((_, i) => (
            <div key={i} className="bg-black" style={{ width: `${Math.random() * 4 + 1}px` }} />
          ))}
        </div>
    </div>

    <div className="text-center space-y-4">
      <p className="text-[10px] text-gray-500 italic">Thank you for building with Bedrock.</p>
      <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-sans text-xs font-semibold shadow-lg active:scale-95">
        <Download className="w-3 h-3" />
        Download PDF
      </button>
    </div>

    <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[length:24px_24px]" style={{
      background: 'linear-gradient(-45deg, transparent 16px, #f8f9fa 0), linear-gradient(45deg, transparent 16px, #f8f9fa 0)',
      backgroundRepeat: 'repeat-x',
      backgroundSize: '24px 24px',
      backgroundPosition: 'left bottom'
    }}/>
  </div>
);

// 3D Scene Component
const ReceiptScene = ({ currentDate }: { currentDate: string }) => {
  const rootRef = useRef<THREE.Group>(null);
  const middleHingeRef = useRef<THREE.Group>(null);
  const bottomHingeRef = useRef<THREE.Group>(null);

  // Mesh dimensions in 3D space to match CSS pixels (roughly 1 unit = 100px)
  const w = 3.8;
  const h1 = 2.5;
  const h2 = 2.0;
  const h3 = 3.2;

  useEffect(() => {
    if (!rootRef.current || !middleHingeRef.current || !bottomHingeRef.current) return;

    // Initial folded state
    gsap.set(rootRef.current.position, { y: 6, z: -3 });
    gsap.set(rootRef.current.rotation, { x: -0.4, y: 0, z: 0 });
    
    // Accordion fold: Middle folds back, Bottom folds forward relative to Middle
    gsap.set(middleHingeRef.current.rotation, { x: -Math.PI * 0.95 });
    gsap.set(bottomHingeRef.current.rotation, { x: Math.PI * 0.95 });

    const tl = gsap.timeline({ delay: 0.2 });

    // Root drops down
    tl.to(rootRef.current.position, {
      y: 3.5, // Stop higher up so the bottom can unfold
      z: 0,
      duration: 1.5,
      ease: "power2.out",
    })
    .to(rootRef.current.rotation, {
      x: 0,
      duration: 1.5,
      ease: "power2.out",
    }, "<")
    
    // Unfold Middle Hinge
    .to(middleHingeRef.current.rotation, {
      x: 0,
      duration: 1.8,
      ease: "elastic.out(1, 0.6)", // Bouncy snap
    }, "-=0.8")
    
    // Unfold Bottom Hinge
    .to(bottomHingeRef.current.rotation, {
      x: 0,
      duration: 1.8,
      ease: "elastic.out(1, 0.6)",
    }, "-=1.4")
    
    // Final subtle tilt and float for the whole assembly
    .to(rootRef.current.rotation, {
      x: 0.05,
      y: 0.05,
      z: -0.02,
      duration: 2,
      ease: "power2.out"
    }, "-=1")
    .to(rootRef.current.position, {
      y: "+=0.1",
      duration: 2.5,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    }, "+=0")
    .to(rootRef.current.rotation, {
      y: "-=0.03",
      x: "-=0.02",
      duration: 3.5,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    }, "<");

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={45} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 8]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
      <spotLight position={[-5, 5, 5]} angle={0.4} penumbra={1} intensity={0.8} castShadow />

      <group ref={rootRef} position={[0, 4, 0]}>
        
        {/* TOP SEGMENT */}
        <mesh position={[0, -h1/2, 0]} receiveShadow castShadow>
          <planeGeometry args={[w, h1]} />
          <meshStandardMaterial color="#f8f9fa" side={THREE.DoubleSide} transparent opacity={0} />
          <Html transform occlude="blending" position={[0, 0, 0.01]} zIndexRange={[100, 0]}>
            <ReceiptTop currentDate={currentDate} />
          </Html>
        </mesh>

        {/* MIDDLE HINGE (attached to bottom of Top Segment) */}
        <group ref={middleHingeRef} position={[0, -h1, 0]}>
          
          {/* MIDDLE SEGMENT */}
          <mesh position={[0, -h2/2, 0]} receiveShadow castShadow>
            <planeGeometry args={[w, h2]} />
            <meshStandardMaterial color="#f8f9fa" side={THREE.DoubleSide} transparent opacity={0} />
            <Html transform occlude="blending" position={[0, 0, 0.01]} zIndexRange={[100, 0]}>
              <ReceiptMiddle />
            </Html>
          </mesh>

          {/* BOTTOM HINGE (attached to bottom of Middle Segment) */}
          <group ref={bottomHingeRef} position={[0, -h2, 0]}>
            
            {/* BOTTOM SEGMENT */}
            <mesh position={[0, -h3/2, 0]} receiveShadow castShadow>
              <planeGeometry args={[w, h3]} />
              <meshStandardMaterial color="#f8f9fa" side={THREE.DoubleSide} transparent opacity={0} />
              <Html transform occlude="blending" position={[0, 0, 0.01]} zIndexRange={[100, 0]}>
                <ReceiptBottom />
              </Html>
            </mesh>

          </group>
        </group>
      </group>

      <ContactShadows position={[0, -5, 0]} opacity={0.6} scale={15} blur={2.5} far={10} />
      <Environment preset="city" />
    </>
  );
};

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

  return (
    <PageTransition>
      <div className="w-full min-h-[calc(100vh-80px)] py-4 flex flex-col items-center relative bg-[#0a0a0a]">
        
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 absolute top-8 left-0 right-0 z-50">
          <Link to="/app/pricing" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Pricing
          </Link>
        </div>

        {/* Printer Slot Graphic */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-6 bg-[#111] rounded-b-2xl border-x border-b border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20">
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-[4px] bg-black rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,1)]" />
          <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 w-[85%] h-[30px] bg-teal-500/10 blur-[20px]" />
        </div>

        <div className="w-full h-full absolute inset-0 pt-16">
          <Canvas shadows dpr={[1, 2]}>
            <Suspense fallback={null}>
              <ReceiptScene currentDate={currentDate} />
            </Suspense>
          </Canvas>
        </div>
        
      </div>
    </PageTransition>
  );
}
