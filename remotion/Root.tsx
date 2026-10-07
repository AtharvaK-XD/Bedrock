import React from 'react';
import { Composition } from 'remotion';
import { BedrockStartupIntro } from './BedrockStartupIntro';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1080p 60fps Full HD Master (30 Seconds · 1800 Frames) */}
      <Composition
        id="BedrockStartupIntro"
        component={BedrockStartupIntro}
        durationInFrames={1800}
        fps={60}
        width={1920}
        height={1080}
      />

      {/* 4K 60fps Ultra HD Master (30 Seconds · 1800 Frames) */}
      <Composition
        id="BedrockStartupIntro4K"
        component={BedrockStartupIntro}
        durationInFrames={1800}
        fps={60}
        width={3840}
        height={2160}
      />
    </>
  );
};
