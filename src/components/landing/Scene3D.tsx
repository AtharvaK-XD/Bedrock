import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Float, ContactShadows, useScroll } from '@react-three/drei';
import { EffectComposer, DepthOfField, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BlendFunction } from 'postprocessing';

// An organic, liquid-like glass object
const LiquidGlassCore = () => {
  const mesh = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x += delta * 0.1;
      mesh.current.rotation.y += delta * 0.15;
    }
    if (materialRef.current) {
      // Slowly pulse the distortion to make it look alive/organic
      materialRef.current.time = state.clock.elapsedTime;
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={0.8} floatIntensity={1.5} floatingRange={[-0.2, 0.2]}>
      <mesh ref={mesh} position={[0, 0, 0]} scale={2.5}>
        <icosahedronGeometry args={[1, 16]} />
        <MeshTransmissionMaterial
          ref={materialRef}
          backside
          samples={8}
          thickness={1.5}
          chromaticAberration={0.06}
          anisotropy={0.3}
          distortion={0.6}
          distortionScale={0.5}
          temporalDistortion={0.2}
          ior={1.5}
          color="#ffffff"
          resolution={1024}
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
  return (
    <div className="absolute inset-0 z-0 pointer-events-none w-full h-full">
      <Canvas 
        camera={{ position: [0, 0, 8], fov: 45 }} 
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
        <directionalLight position={[-10, -10, -5]} intensity={1.5} color="#2c9a8b" /> {/* Copper tint */}
        
        <LiquidGlassCore />
        <ScrollManager />
        
        {/* Photorealistic Environment */}
        <Environment preset="city" />
        
        {/* Soft grounding shadow */}
        <ContactShadows position={[0, -3.5, 0]} opacity={0.5} scale={15} blur={2.5} far={4} />
        
        {/* Cinematic Post-Processing */}
        <EffectComposer disableNormalPass>
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} opacity={0.5} />
          <Noise opacity={0.035} blendFunction={BlendFunction.OVERLAY} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
