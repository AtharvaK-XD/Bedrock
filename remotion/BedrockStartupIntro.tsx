import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Scene1ProblemAndGenesis } from './scenes/Scene1ProblemAndGenesis';
import { Scene2FrontierMatrix } from './scenes/Scene2FrontierMatrix';
import { Scene3PromptCompiler } from './scenes/Scene3PromptCompiler';
import { Scene4DAGBranching } from './scenes/Scene4DAGBranching';
import { Scene5ArenaAndFrameworks } from './scenes/Scene5ArenaAndFrameworks';
import { Scene6MonolithicFinale } from './scenes/Scene6MonolithicFinale';
import { KineticVoiceSync } from './components/KineticVoiceSync';

export const BedrockStartupIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#06080d' }}>
      {/* ======================================================== */}
      {/* 🎵 CINEMATIC AUDIO MASTER SUITE (VOICEOVER + MUSIC + SFX) */}
      {/* ======================================================== */}

      {/* Background Cyberpunk Synth Soundtrack (Calibrated Ducking) */}
      <Audio src={staticFile('audio/soundtrack.wav')} volume={0.32} />

      {/* ======================================================== */}
      {/* 🎙️ AI DEEP HEAVY VOICE NARRATION TRACKS                  */}
      {/* ======================================================== */}

      {/* Act 1 Narration (0s - 11.4s / Frames 0 - 340) */}
      <Sequence from={0} durationInFrames={340}>
        <Audio src={staticFile('audio/voiceover/act1_genesis.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 2 Narration (11.4s - 23.0s / Frames 340 - 690) */}
      <Sequence from={340} durationInFrames={350}>
        <Audio src={staticFile('audio/voiceover/act2_workstation.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 3 Narration (23.0s - 32.3s / Frames 690 - 970) */}
      <Sequence from={690} durationInFrames={280}>
        <Audio src={staticFile('audio/voiceover/act3_synthesis.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 4 Narration (32.3s - 43.6s / Frames 970 - 1310) */}
      <Sequence from={970} durationInFrames={340}>
        <Audio src={staticFile('audio/voiceover/act4_branching.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 5 Narration (43.6s - 51.6s / Frames 1310 - 1550) */}
      <Sequence from={1310} durationInFrames={240}>
        <Audio src={staticFile('audio/voiceover/act5_arena.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 6 Narration (51.6s - 60.0s / Frames 1550 - 1800) */}
      <Sequence from={1550} durationInFrames={250}>
        <Audio src={staticFile('audio/voiceover/act6_finale.mp3')} volume={1.0} />
      </Sequence>

      {/* ======================================================== */}
      {/* 💥 SYNCHRONIZED TRAILER SFX IMPACTS                      */}
      {/* ======================================================== */}

      {/* Opening Sub-Bass Drop (Frame 0) */}
      <Sequence from={0} durationInFrames={90}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.8} />
      </Sequence>

      {/* Glitch Error Warning (Frame 45) */}
      <Sequence from={45} durationInFrames={30}>
        <Audio src={staticFile('audio/glitch.wav')} volume={0.65} />
      </Sequence>

      {/* Act 1 Transformation Heavy Whoosh (Frame 165) */}
      <Sequence from={165} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh-heavy.wav')} volume={0.7} />
      </Sequence>

      {/* Act 2 Frontier Matrix Entrance Laser Whoosh & Chime (Frame 340) */}
      <Sequence from={340} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.75} />
        <Audio src={staticFile('audio/chime.wav')} volume={0.65} />
      </Sequence>

      {/* Act 3 Synthesis Compiler Heavy Whoosh (Frame 690) */}
      <Sequence from={690} durationInFrames={50}>
        <Audio src={staticFile('audio/whoosh-heavy.wav')} volume={0.75} />
        <Audio src={staticFile('audio/click.wav')} volume={0.8} />
      </Sequence>

      {/* Act 4 DAG Branching Transition Whoosh (Frame 970) */}
      <Sequence from={970} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.7} />
      </Sequence>

      {/* Act 4 Pruning Cut Impact (Frame 1120) */}
      <Sequence from={1120} durationInFrames={30}>
        <Audio src={staticFile('audio/glitch.wav')} volume={0.6} />
      </Sequence>

      {/* Act 5 Arena Clash Dual Impact (Frame 1310) */}
      <Sequence from={1310} durationInFrames={60}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.85} />
      </Sequence>

      {/* Act 5 Framework Expansion Whoosh (Frame 1395) */}
      <Sequence from={1395} durationInFrames={45}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.7} />
      </Sequence>

      {/* Act 6 Finale Emerald Shockwave & Climax Impact (Frame 1550 & 1658) */}
      <Sequence from={1550} durationInFrames={60}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.75} />
      </Sequence>
      <Sequence from={1658} durationInFrames={90}>
        <Audio src={staticFile('audio/chime.wav')} volume={0.95} />
        <Audio src={staticFile('audio/impact.wav')} volume={0.9} />
        <Audio src={staticFile('audio/click.wav')} volume={0.85} />
      </Sequence>

      {/* ======================================================== */}
      {/* 🎬 6 PROCEDURAL MOTION GRAPHIC ACTS (1800 FRAMES = 60s)  */}
      {/* ======================================================== */}

      {/* Act 1: The Problem & Genesis (0.0s – 11.4s) */}
      <Sequence from={0} durationInFrames={350}>
        <Scene1ProblemAndGenesis />
      </Sequence>

      {/* Act 2: Frontier Intelligence Matrix & Telemetry HUD (11.3s – 23.0s) */}
      <Sequence from={340} durationInFrames={360}>
        <Scene2FrontierMatrix />
      </Sequence>

      {/* Act 3: Neural Prompt Compiler & Zero-Coding Directives (23.0s – 32.3s) */}
      <Sequence from={690} durationInFrames={290}>
        <Scene3PromptCompiler />
      </Sequence>

      {/* Act 4: Infinite DAG Canvas & Tactile Branching Physics (32.3s – 43.6s) */}
      <Sequence from={970} durationInFrames={350}>
        <Scene4DAGBranching />
      </Sequence>

      {/* Act 5: Arena Head-to-Head Clash & 15 Multi-Target Exporters (43.6s – 51.6s) */}
      <Sequence from={1310} durationInFrames={250}>
        <Scene5ArenaAndFrameworks />
      </Sequence>

      {/* Act 6: Monolithic Finale, Kinetic Climax & Download CTA (51.6s – 60.0s) */}
      <Sequence from={1550} durationInFrames={250}>
        <Scene6MonolithicFinale />
      </Sequence>

      {/* ======================================================== */}
      {/* 🔤 KINETIC SUBTITLE & AUDIO SYNC OVERLAY                 */}
      {/* ======================================================== */}
      <KineticVoiceSync />
    </AbsoluteFill>
  );
};
