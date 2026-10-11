import React from 'react';
import { Composition } from 'remotion';
import { BedrockStartupIntro } from './BedrockStartupIntro';

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
