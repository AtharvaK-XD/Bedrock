import { Canvas } from '@react-three/fiber';
import { Html, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { useRef, useEffect, useState, Suspense } from 'react';
import gsap from 'gsap';
import { ArrowLeft, CheckCircle2, ShieldCheck, CreditCard, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { PageTransition } from '../components/layout/PageTransition';

// The React UI for the Receipt
const ReceiptUI = ({ currentDate }: { currentDate: string }) => {
  return (
    <div 
      className="w-[380px] bg-[#f8f9fa] text-gray-900 relative pt-10 pb-12 px-8 font-mono select-none"
      style={{
        // Let's add a subtle paper texture/noise using CSS
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.02)'
      }}
    >
      {/* Top jagged edge decoration */}
      <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-transparent via-[#f8f9fa] to-transparent bg-[length:12px_12px]" style={{
        backgroundImage: 'radial-gradient(circle at 6px 0, transparent 6px, #f8f9fa 6.5px)'
      }}/>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-100 text-teal-600 mb-4 shadow-sm">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold font-editorial tracking-tight text-black mb-1">Upgrade Successful</h2>
        <p className="text-xs text-gray-500 uppercase tracking-widest">Order Receipt</p>
      </div>

      <div className="space-y-1 mb-6 text-sm">
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

      <div className="w-full h-[1px] bg-gray-300 mb-6 border-b border-dashed border-gray-400" />

      <div className="mb-6">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Subscription Detail</h3>
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-bold text-lg text-black">Advanced Plan</p>
            <p className="text-xs text-gray-500">Billed monthly</p>
          </div>
          <p className="font-bold text-lg text-black">₹399.00</p>
        </div>
      </div>

      <div className="w-full h-[1px] bg-gray-300 mb-6 border-b border-dashed border-gray-400" />

      <div className="space-y-2 mb-8">
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
      </div>

      <div className="bg-gray-100 p-4 rounded-lg flex items-center gap-3 mb-8 border border-gray-200 shadow-sm">
        <CreditCard className="w-5 h-5 text-gray-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Visa ending in 4242</p>
          <p className="text-xs text-gray-500">Authenticated via Stripe</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-teal-600" />
      </div>

      {/* Barcode Mock */}
      <div className="flex justify-center mb-8 opacity-70">
          <div className="flex h-14 gap-[2px]">
            {[...Array(45)].map((_, i) => (
              <div key={i} className="bg-black" style={{ width: `${Math.random() * 4 + 1}px` }} />
            ))}
          </div>
      </div>

      <div className="text-center space-y-4">
        <p className="text-xs text-gray-500 italic">Thank you for building with Bedrock.</p>
        
        <button 
          className="flex items-center justify-center gap-2 w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-sans text-sm font-semibold shadow-lg active:scale-95"
          onClick={() => console.log('Downloading PDF...')}
        >
          <Download className="w-4 h-4" />
          Download PDF Receipt
        </button>
      </div>

      {/* Bottom jagged edge */}
      <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[length:24px_24px]" style={{
        background: 'linear-gradient(-45deg, transparent 16px, #f8f9fa 0), linear-gradient(45deg, transparent 16px, #f8f9fa 0)',
        backgroundRepeat: 'repeat-x',
        backgroundSize: '24px 24px',
        backgroundPosition: 'left bottom'
      }}/>
    </div>
  );
};

// 3D Scene Component
const ReceiptScene = ({ currentDate }: { currentDate: string }) => {
  const receiptRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!receiptRef.current) return;

    // Initial state: hidden in the "printer slot" above and angled back
    gsap.set(receiptRef.current.position, { y: 6, z: -2 });
    gsap.set(receiptRef.current.rotation, { x: -0.5, y: 0, z: 0 });

    // Printing animation sequence
    const tl = gsap.timeline({ delay: 0.2 });

    tl.to(receiptRef.current.position, {
      y: 0,
      z: 0,
      duration: 2.5,
      ease: "power2.out", // Smooth deceleration simulating printing
    })
    .to(receiptRef.current.rotation, {
      x: 0.1, // Slight tilt forward at the end for readability
      y: (Math.random() - 0.5) * 0.1, // Slight random twist
      z: (Math.random() - 0.5) * 0.05, // Slight random tilt
      duration: 2.5,
      ease: "power2.out",
    }, "<") // Start at the same time
    // Add a subtle floating animation after printing
    .to(receiptRef.current.position, {
      y: "+=0.1",
      duration: 2,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    }, "+=0.5")
    .to(receiptRef.current.rotation, {
      y: "+=0.05",
      x: "+=0.02",
      duration: 3,
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
      <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
      
      {/* Lighting for realism */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
      <spotLight position={[-5, 5, 5]} angle={0.3} penumbra={1} intensity={0.5} castShadow />

      <group ref={receiptRef}>
        {/* We use an invisible plane mesh to catch shadows behind the Html, but Html transform handles the visual rendering */}
        <mesh receiveShadow castShadow>
          <planeGeometry args={[3.8, 8]} />
          <meshStandardMaterial color="#f8f9fa" side={THREE.DoubleSide} transparent opacity={0} />
          
          <Html 
            transform 
            occlude="blending" 
            castShadow 
            receiveShadow
            distanceFactor={1.5}
            position={[0, 0, 0.01]} // Slightly offset to prevent z-fighting with the invisible plane
            zIndexRange={[100, 0]}
          >
            <ReceiptUI currentDate={currentDate} />
          </Html>
        </mesh>
      </group>

      {/* Realistic contact shadows on the "floor/wall" */}
      <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={10} blur={2.5} far={10} />
      
      {/* Environment reflections */}
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
      <div className="w-full min-h-[calc(100vh-80px)] py-4 flex flex-col items-center relative bg-black">
        
        {/* Navigation overlay */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 absolute top-8 left-0 right-0 z-50">
          <Link to="/app/pricing" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Pricing
          </Link>
        </div>

        {/* Printer Slot Graphic at the top of the viewport */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[450px] h-4 bg-[#111] rounded-b-xl border-x border-b border-white/10 shadow-2xl z-20">
          <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 w-[90%] h-[3px] bg-black rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,1)]" />
          
          {/* Subtle glow emitting from the slot */}
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-[80%] h-[20px] bg-teal-500/10 blur-[15px]" />
        </div>

        {/* 3D Canvas */}
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
