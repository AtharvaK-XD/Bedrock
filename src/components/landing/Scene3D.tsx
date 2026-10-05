import { useRef, useState, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Float, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BlendFunction } from 'postprocessing';

// Pre-flight check for WebGL/WebGL2 capability on client device
function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return Boolean(gl && ((window.WebGLRenderingContext && gl instanceof WebGLRenderingContext) || (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext)));
  } catch {
    return false;
  }
}

// Error Boundary specifically guarding WebGL canvas creation and context loss
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class Scene3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[Scene3D] WebGL renderer initialization bypassed gracefully:', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Visual fallback rendered when WebGL is unsupported, disabled, or context is lost
const AmbientVisualFallback = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
      {/* Organic radial ambient light field matching the 3D aesthetic */}
      <div className="absolute w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-copper-500/15 via-[#2c9a8b]/10 to-transparent blur-[160px] animate-pulse" />
      <div className="absolute w-[420px] h-[420px] rounded-full border border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-3xl shadow-[0_0_100px_rgba(44,154,139,0.12)]" />
    </div>
  );
};

// An organic, liquid-like glass object
const LiquidGlassCore = () => {
  const mesh = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  const currentScrollProgress = useRef(0);

  useFrame((state) => {
    if (materialRef.current) {
      // Slowly pulse the distortion to make it look alive/organic
      materialRef.current.time = state.clock.elapsedTime;
    }

    if (mesh.current) {
      const scrollY = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const targetScrollProgress = scrollY / maxScroll;

      // Smoothly interpolate the scroll progress for a fluid rotation effect
      currentScrollProgress.current = THREE.MathUtils.lerp(
        currentScrollProgress.current,
        targetScrollProgress,
        0.05
      );

      // Combine continuous rotation with smooth scroll-driven rotation
      mesh.current.rotation.x = (state.clock.elapsedTime * 0.1) + (currentScrollProgress.current * Math.PI * 2);
      mesh.current.rotation.y = (state.clock.elapsedTime * 0.15) + (currentScrollProgress.current * Math.PI * 4);
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={0.8} floatIntensity={1.5} floatingRange={[-0.2, 0.2]}>
      <mesh ref={mesh} position={[0, 0, 0]} scale={2.5}>
        <icosahedronGeometry args={[1, 8]} />
        <MeshTransmissionMaterial
          ref={materialRef}
          backside
          samples={2}
          thickness={1.5}
          chromaticAberration={0.06}
          anisotropy={0.3}
          distortion={0.6}
          distortionScale={0.5}
          temporalDistortion={0.2}
          ior={1.5}
          color="#ffffff"
          resolution={128}
        />
      </mesh>
    </Float>
  );
};

// Global scroll controller for the 3D scene driven by the window scroll
const ScrollManager = () => {
  const { camera, pointer } = useThree();
  const vec = new THREE.Vector3();
  
  useFrame(() => {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
    
    // Z-axis: Fly towards the object, but don't clip inside it (min Z is 3.5, object radius is 2)
    const targetZ = 8 - (Math.sin(scrollProgress * Math.PI) * 4.5);
    
    // Y-axis: scroll dip + mouse parallax
    const targetY = -(scrollProgress * 3) + (pointer.y * 1.5);
    
    // X-axis: sway + mouse parallax
    const targetX = (Math.sin(scrollProgress * Math.PI * 2) * 2) + (pointer.x * 1.5);
    
    camera.position.lerp(vec.set(targetX, targetY, targetZ), 0.05);
    camera.lookAt(0, 0, 0);
  });
  
  return null;
};

export const Scene3D = () => {
  const [canRenderWebGL, setCanRenderWebGL] = useState(false);

  useEffect(() => {
    setCanRenderWebGL(isWebGLSupported());
  }, []);

  if (!canRenderWebGL) {
    return <AmbientVisualFallback />;
  }

  return (
    <div className="absolute inset-0 z-0 pointer-events-none w-full h-full">
      <Scene3DErrorBoundary fallback={<AmbientVisualFallback />}>
        <Canvas 
          camera={{ position: [0, 0, 8], fov: 45 }} 
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          dpr={[1, 1.5]}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('[Scene3D] WebGL context lost.');
            }, false);
          }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <directionalLight position={[-10, -10, -5]} intensity={1.5} color="#2c9a8b" /> {/* Copper tint */}
          
          <LiquidGlassCore />
          <ScrollManager />
          
          {/* Photorealistic Environment */}
          <Environment preset="city" />
          
          {/* Soft grounding shadow */}
          <ContactShadows position={[0, -3.5, 0]} opacity={0.5} scale={15} blur={2.5} far={4} resolution={256} frames={1} />
          
          {/* Cinematic Post-Processing */}
          <EffectComposer multisampling={0}>
            <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} opacity={0.5} />
            <Noise opacity={0.035} blendFunction={BlendFunction.OVERLAY} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </Scene3DErrorBoundary>
    </div>
  );
};
