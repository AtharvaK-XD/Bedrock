import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Scene1ProblemAndGenesis } from './scenes/Scene1ProblemAndGenesis';
import { Scene2LandingParallaxScroll } from './scenes/Scene2LandingParallaxScroll';
import { Scene3DashboardTelemetry } from './scenes/Scene3DashboardTelemetry';
import { Scene4SynthesisWizard } from './scenes/Scene4SynthesisWizard';
import { Scene5BranchingDAGCanvas } from './scenes/Scene5BranchingDAGCanvas';
import { Scene6ArenaAndLibrary } from './scenes/Scene6ArenaAndLibrary';
import { Scene7MonolithicFinale } from './scenes/Scene7MonolithicFinale';

export const BedrockStartupIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#06080d' }}>
      {/* ======================================================== */}
      {/* 🎵 CINEMATIC AUDIO SUITE: FULL 60-SEC SOUNDTRACK & SFX   */}
      {/* ======================================================== */}

      {/* Main 60-Second Cyberpunk Synth Soundtrack */}
      <Audio src={staticFile('audio/soundtrack.wav')} volume={0.88} />

      {/* Synchronized SFX: Opening Sub-Bass Drop (Frame 0) */}
      <Sequence from={0} durationInFrames={90}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.8} />
      </Sequence>

      {/* Synchronized SFX: Problem Glitch Warning (Frame 45) */}
      <Sequence from={45} durationInFrames={30}>
        <Audio src={staticFile('audio/glitch.wav')} volume={0.65} />
      </Sequence>

      {/* Synchronized SFX: Compiler Scanline Transformation Whoosh (Frame 165) */}
      <Sequence from={165} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh-heavy.wav')} volume={0.7} />
      </Sequence>

      {/* Synchronized SFX: Monolith Genesis Chime & Sub-Bass (Frame 315) */}
      <Sequence from={315} durationInFrames={90}>
        <Audio src={staticFile('audio/chime.wav')} volume={0.85} />
        <Audio src={staticFile('audio/impact.wav')} volume={0.7} />
      </Sequence>

      {/* Synchronized SFX: Scene 2 Landing Page Whoosh & Click (Frame 430 & 550) */}
      <Sequence from={430} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.65} />
      </Sequence>
      <Sequence from={550} durationInFrames={15}>
        <Audio src={staticFile('audio/click.wav')} volume={0.75} />
      </Sequence>

      {/* Synchronized SFX: Scene 3 Telemetry Dashboard Whoosh (Frame 700) */}
      <Sequence from={700} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.65} />
      </Sequence>

      {/* Synchronized SFX: Scene 4 Synthesis Wizard Heavy Whoosh & Click (Frame 970) */}
      <Sequence from={970} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh-heavy.wav')} volume={0.7} />
        <Audio src={staticFile('audio/click.wav')} volume={0.7} />
      </Sequence>

      {/* Synchronized SFX: Scene 5 Branching Canvas Whoosh (Frame 1240) */}
      <Sequence from={1240} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.65} />
      </Sequence>

      {/* Synchronized SFX: Scene 6 Arena & Library Impact Drop (Frame 1510) */}
      <Sequence from={1510} durationInFrames={60}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.75} />
      </Sequence>

      {/* Synchronized SFX: Scene 7 Emerald Shockwave & Climax (Frame 1690) */}
      <Sequence from={1690} durationInFrames={90}>
        <Audio src={staticFile('audio/chime.wav')} volume={0.95} />
        <Audio src={staticFile('audio/impact.wav')} volume={0.85} />
        <Audio src={staticFile('audio/click.wav')} volume={0.8} />
      </Sequence>

      {/* ======================================================== */}
      {/* 🎬 7-ACT MASTER STARTUP LAUNCH FILM (1800 FRAMES = 60.0s) */}
      {/* ======================================================== */}

      {/* Act 1: The Problem, Compiler Transformation & Monolith Genesis (0.0s – 15.0s) */}
      <Sequence from={0} durationInFrames={450}>
        <Scene1ProblemAndGenesis />
      </Sequence>

      {/* Act 2: Real Landing Page Hero & 3D Parallax Scroll (14.3s – 24.0s) */}
      <Sequence from={430} durationInFrames={290}>
        <Scene2LandingParallaxScroll />
      </Sequence>

      {/* Act 3: Workspace 01 — Real Telemetry Dashboard & Metrics HUD (23.3s – 33.0s) */}
      <Sequence from={700} durationInFrames={290}>
        <Scene3DashboardTelemetry />
      </Sequence>

      {/* Act 4: Workspace 02 — Real System Prompt Synthesis Engine (32.3s – 42.0s) */}
      <Sequence from={970} durationInFrames={290}>
        <Scene4SynthesisWizard />
      </Sequence>

      {/* Act 5: Workspace 03 — Real Visual Branching Canvas XYFlow DAG (41.3s – 51.0s) */}
      <Sequence from={1240} durationInFrames={290}>
        <Scene5BranchingDAGCanvas />
      </Sequence>

      {/* Act 6: Workspaces 04 & 05 — The Arena Benchmark & Curated Library (50.3s – 57.0s) */}
      <Sequence from={1510} durationInFrames={200}>
        <Scene6ArenaAndLibrary />
      </Sequence>

      {/* Act 7: Emerald Shockwave & Monolithic Brand Finale (56.3s – 60.0s) */}
      <Sequence from={1690} durationInFrames={110}>
        <Scene7MonolithicFinale />
      </Sequence>
    </AbsoluteFill>
  );
};
