import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Scene1ProblemAndGenesis } from './scenes/Scene1ProblemAndGenesis';
import { Scene2FrontierMatrix } from './scenes/Scene2FrontierMatrix';
import { Scene3PromptCompiler } from './scenes/Scene3PromptCompiler';
import { Scene4DAGBranching } from './scenes/Scene4DAGBranching';
import { Scene5ArenaAndFrameworks } from './scenes/Scene5ArenaAndFrameworks';
import { Scene6MonolithicFinale } from './scenes/Scene6MonolithicFinale';
import { GlobalAtmosphere } from './components/GlobalAtmosphere';
import { GlobalProgressRail } from './components/GlobalProgressRail';
import { HIT_FRAMES } from './components/MotionTokens';

export const BedrockStartupIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#05080a', overflow: 'hidden' }}>
      {/* ======================================================== */}
      {/* 🌌 GLOBAL LIGHTING, GRADE & VOLUMETRIC ATMOSPHERE (6.1) */}
      {/* ======================================================== */}
      <GlobalAtmosphere />

      {/* ======================================================== */}
      {/* 📜 S7 GLOBAL PROGRESS RAIL (x: 1884, 0 -> 100%)          */}
      {/* ======================================================== */}
      <GlobalProgressRail />

      {/* ======================================================== */}
      {/* 🎵 CINEMATIC AUDIO MASTER SUITE (MASTERED -14 LUFS)      */}
      {/* ======================================================== */}
      {/* Soundtrack with deterministic ducking before the 5 hits & fade-out */}
      <Audio
        src={staticFile('audio/soundtrack-mastered.wav')}
        volume={(f) => {
          // Fade-out over the last 0.5s (frames 3570 - 3600)
          if (f >= 3570) {
            return Math.max(0, 0.32 * (1 - (f - 3570) / 30));
          }

          // Ducking 3-6 dB before each hit (30 frames prior)
          let duckFactor = 1.0;
          Object.values(HIT_FRAMES).forEach((hit) => {
            if (f >= hit - 30 && f < hit) {
              const duckDepth = (30 - (hit - f)) / 30; // 0 -> 1
              duckFactor = Math.min(duckFactor, 1.0 - duckDepth * 0.45); // ducks ~4 dB
            }
          });

          return 0.32 * duckFactor;
        }}
      />

      {/* ======================================================== */}
      {/* 🎙️ MASTER NARRATION TRACKS (60 FPS CALIBRATED)           */}
      {/* ======================================================== */}
      {/* Act 1 Narration (0.0s - 11.8s / Frames 0 - 708) */}
      <Sequence from={0} durationInFrames={708}>
        <Audio src={staticFile('audio/voiceover/act1_genesis.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 2 Narration (11.8s - 23.8s / Frames 708 - 1428) */}
      <Sequence from={708} durationInFrames={720}>
        <Audio src={staticFile('audio/voiceover/act2_workstation.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 3 Narration (23.8s - 32.0s / Frames 1428 - 1920) */}
      <Sequence from={1428} durationInFrames={492}>
        <Audio src={staticFile('audio/voiceover/act3_synthesis.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 4 Narration (32.0s - 43.3s / Frames 1920 - 2598) */}
      <Sequence from={1920} durationInFrames={678}>
        <Audio src={staticFile('audio/voiceover/act4_branching.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 5 Narration (43.3s - 51.9s / Frames 2598 - 3114) */}
      <Sequence from={2598} durationInFrames={516}>
        <Audio src={staticFile('audio/voiceover/act5_arena.mp3')} volume={1.0} />
      </Sequence>

      {/* Act 6 Narration (51.9s - 60.0s / Frames 3114 - 3600) */}
      <Sequence from={3114} durationInFrames={486}>
        <Audio src={staticFile('audio/voiceover/act6_finale.mp3')} volume={1.0} />
      </Sequence>

      {/* ======================================================== */}
      {/* 💥 SYNCHRONIZED SFX IMPACTS                              */}
      {/* ======================================================== */}
      {/* Frame 0 Sub-bass Drop */}
      <Sequence from={0} durationInFrames={90}>
        <Audio src={staticFile('audio/impact.wav')} volume={(f) => Math.min(0.75, f / 6)} />
      </Sequence>

      {/* Frame 90 Glitch Error Warning */}
      <Sequence from={90} durationInFrames={60}>
        <Audio src={staticFile('audio/glitch.wav')} volume={0.65} />
      </Sequence>

      {/* Frame 330 Transformation Heavy Whoosh */}
      <Sequence from={330} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh-heavy.wav')} volume={0.7} />
      </Sequence>

      {/* Frame 680 (11.33s Hit 1): Logo Resolve Laser Whoosh & Chime */}
      <Sequence from={680} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.75} />
        <Audio src={staticFile('audio/chime.wav')} volume={0.65} />
      </Sequence>

      {/* Frame 1428 Compiler Transition Whoosh & Click */}
      <Sequence from={1428} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh-heavy.wav')} volume={0.7} />
        <Audio src={staticFile('audio/click.wav')} volume={0.75} />
      </Sequence>

      {/* Frame 1920 DAG Branching Transition Whoosh */}
      <Sequence from={1920} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.7} />
      </Sequence>

      {/* Frame 2220 Pruning Cut Glitch Crackle */}
      <Sequence from={2220} durationInFrames={60}>
        <Audio src={staticFile('audio/glitch.wav')} volume={0.6} />
      </Sequence>

      {/* Frame 2598 (43.3s Hit 2): Arena Dual Clash Impact */}
      <Sequence from={2598} durationInFrames={70}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.8} />
        <Audio src={staticFile('audio/click.wav')} volume={0.7} />
      </Sequence>

      {/* Frame 2820 Framework Expansion Whoosh */}
      <Sequence from={2820} durationInFrames={60}>
        <Audio src={staticFile('audio/whoosh.wav')} volume={0.7} />
      </Sequence>

      {/* Frame 3120 (52.0s Hit 3): "Stop guessing." Crash Impact */}
      <Sequence from={3120} durationInFrames={60}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.65} />
      </Sequence>

      {/* Frame 3225 (53.75s Hit 4): "Start engineering." Climax Impact */}
      <Sequence from={3225} durationInFrames={60}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.7} />
      </Sequence>

      {/* Frame 3317 (55.28s Hit 5): End-card Logo Slam & Chime */}
      <Sequence from={3317} durationInFrames={90}>
        <Audio src={staticFile('audio/impact.wav')} volume={0.5} />
        <Audio src={staticFile('audio/chime.wav')} volume={0.65} />
        <Audio src={staticFile('audio/click.wav')} volume={0.6} />
      </Sequence>

      {/* ======================================================== */}
      {/* 🎬 6 PROCEDURAL MOTION GRAPHIC ACTS (3600 FRAMES = 60s)  */}
      {/* ======================================================== */}
      {/* Act 1: The Problem & Genesis (0.0s – 11.8s / Frames 0 – 708) */}
      <Sequence from={0} durationInFrames={708}>
        <Scene1ProblemAndGenesis />
      </Sequence>

      {/* Act 2: Frontier Intelligence Matrix & Telemetry HUD (11.8s – 23.8s / Frames 708 – 1428) */}
      <Sequence from={708} durationInFrames={720}>
        <Scene2FrontierMatrix />
      </Sequence>

      {/* Act 3: Neural Prompt Compiler & Zero-Coding Directives (23.8s – 32.0s / Frames 1428 – 1920) */}
      <Sequence from={1428} durationInFrames={492}>
        <Scene3PromptCompiler />
      </Sequence>

      {/* Act 4: Infinite DAG Canvas & Tactile Branching Physics (32.0s – 43.3s / Frames 1920 – 2598) */}
      <Sequence from={1920} durationInFrames={678}>
        <Scene4DAGBranching />
      </Sequence>

      {/* Act 5: Arena Head-to-Head Clash & 15 Multi-Target Exporters (43.3s – 51.9s / Frames 2598 – 3114) */}
      <Sequence from={2598} durationInFrames={516}>
        <Scene5ArenaAndFrameworks />
      </Sequence>

      {/* Act 6: Monolithic Finale, Kinetic Climax & Download CTA (51.9s – 60.0s / Frames 3114 – 3600) */}
      <Sequence from={3114} durationInFrames={486}>
        <Scene6MonolithicFinale />
      </Sequence>
    </AbsoluteFill>
  );
};
