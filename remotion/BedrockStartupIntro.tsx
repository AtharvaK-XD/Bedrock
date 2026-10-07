import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Scene1LandingHero } from './scenes/Scene1LandingHero';
import { Scene2DashboardHUD } from './scenes/Scene2DashboardHUD';
import { Scene3GeneratorWizard } from './scenes/Scene3GeneratorWizard';
import { Scene4BranchingDAG } from './scenes/Scene4BranchingDAG';
import { Scene5ArenaAndLibrary } from './scenes/Scene5ArenaAndLibrary';
import { Scene6CinematicClimax } from './scenes/Scene6CinematicClimax';

export const BedrockStartupIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#06080d' }}>
      {/* ======================================================== */}
      {/* 🎵 CINEMATIC AUDIO SUITE: SOUNDTRACK & SYNCHRONIZED SFX */}
      {/* ======================================================== */}

      {/* Main 30-Second Cyberpunk Synth Soundtrack */}
      <Audio src={staticFile('audio/soundtrack.wav')} volume={0.85} />

      {/* Synchronized SFX: Opening Sub-Bass Drop (Frame 0) */}
      <Sequence from={0} durationInFrames={120}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.75} />
      </Sequence>

      {/* Synchronized SFX: Scene 2 Whoosh (Frame 220) */}
      <Sequence from={220} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.6} />
      </Sequence>

      {/* Synchronized SFX: Scene 3 Wizard Click & Whoosh (Frame 520) */}
      <Sequence from={520} durationInFrames={60}>
        <Audio src={staticFile('audio/click.wav')} volume={0.7} />
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.5} />
      </Sequence>

      {/* Synchronized SFX: Scene 4 DAG Canvas Whoosh (Frame 840) */}
      <Sequence from={840} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.6} />
      </Sequence>

      {/* Synchronized SFX: Scene 5 Arena Impact Drop (Frame 1160) */}
      <Sequence from={1160} durationInFrames={90}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.65} />
      </Sequence>

      {/* Synchronized SFX: Scene 6 Emerald Chime & Climax (Frame 1480) */}
      <Sequence from={1480} durationInFrames={150}>
        <Audio src={staticFile('audio/chime.wav')} volume={0.9} />
        <Audio src={staticFile('audio/impact.wav')} volume={0.8} />
      </Sequence>

      {/* ======================================================== */}
      {/* 🎬 6-SCENE CINEMATIC WORKSTATION TRAILER (1800 FRAMES)  */}
      {/* ======================================================== */}

      {/* Scene 1: Real Landing Page Hero & Brand Genesis (0s - 4.0s) */}
      <Sequence from={0} durationInFrames={240}>
        <Scene1LandingHero />
      </Sequence>

      {/* Scene 2: Real Telemetry Dashboard & 2D Dispatch Topology (3.6s - 9.0s) */}
      <Sequence from={220} durationInFrames={320}>
        <Scene2DashboardHUD />
      </Sequence>

      {/* Scene 3: Real System Prompt Synthesis Wizard (8.6s - 14.3s) */}
      <Sequence from={520} durationInFrames={340}>
        <Scene3GeneratorWizard />
      </Sequence>

      {/* Scene 4: Real Visual Branching Canvas & XYFlow DAG (14.0s - 19.6s) */}
      <Sequence from={840} durationInFrames={340}>
        <Scene4BranchingDAG />
      </Sequence>

      {/* Scene 5: Real Multi-Model Arena & Curated Library (19.3s - 25.0s) */}
      <Sequence from={1160} durationInFrames={340}>
        <Scene5ArenaAndLibrary />
      </Sequence>

      {/* Scene 6: Emerald Shockwave & Monolithic Brand Finale (24.6s - 30.0s) */}
      <Sequence from={1480} durationInFrames={320}>
        <Scene6CinematicClimax />
      </Sequence>
    </AbsoluteFill>
  );
};
