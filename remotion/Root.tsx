import React from 'react';
import { Composition } from 'remotion';
import { BedrockStartupIntro } from './BedrockStartupIntro';
import { BedrockLaunch } from './launch/BedrockLaunch';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Launch film — 2K (2560x1440) 60fps master, 60.0 s */}
      <Composition
        id="BedrockLaunch2K"
        component={BedrockLaunch}
        durationInFrames={3600}
        fps={60}
        width={2560}
        height={1440}
      />

      {/* Launch film — 1080p preview of the same timeline (faster renders) */}
      <Composition
        id="BedrockLaunchPreview"
        component={BedrockLaunch}
        durationInFrames={3600}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* 1080p 60fps Master (Strictly 60.0 Seconds · 3600 Frames) */}
      <Composition
        id="BedrockStartupIntro"
        component={BedrockStartupIntro}
        durationInFrames={3600}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* 4K 60fps Ultra HD Master (Strictly 60.0 Seconds · 3600 Frames) */}
      <Composition
        id="BedrockStartupIntro4K"
        component={BedrockStartupIntro}
        durationInFrames={3600}
        fps={60}
        width={3840}
        height={2160}
      />
    </>
  );
};
