import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Scene1Decryption } from './scenes/Scene1Decryption';
import { Scene2Monolith } from './scenes/Scene2Monolith';
import { Scene3HologramUI } from './scenes/Scene3HologramUI';
import { Scene4EmeraldIgnition } from './scenes/Scene4EmeraldIgnition';

export const BedrockStartupIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#06080d' }}>
      {/* Scene 1: Matrix Decryption Scrambler & Initialization (0s - 3s) */}
      <Sequence from={0} durationInFrames={180}>
        <Scene1Decryption />
      </Sequence>

      {/* Scene 2: 3D Bedrock Monolith & Architecture Badges (2.6s - 6.3s) */}
      <Sequence from={160} durationInFrames={220}>
        <Scene2Monolith />
      </Sequence>

      {/* Scene 3: Holographic UI & DAG Branching Canvas Assembly (6.0s - 10.3s) */}
      <Sequence from={360} durationInFrames={260}>
        <Scene3HologramUI />
      </Sequence>

      {/* Scene 4: Emerald Ignition Shockwave & Brand Climax (10.0s - 15.0s) */}
      <Sequence from={600} durationInFrames={300}>
        <Scene4EmeraldIgnition />
      </Sequence>
    </AbsoluteFill>
  );
};
