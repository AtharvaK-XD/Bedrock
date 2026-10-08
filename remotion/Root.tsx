import React from 'react';
import { Composition } from 'remotion';
import { BedrockStartupIntro } from './BedrockStartupIntro';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1080p 30fps Master (Strictly 60.0 Seconds · 1800 Frames) */}
      <Composition
        id="BedrockStartupIntro"
        component={BedrockStartupIntro}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 4K 30fps Ultra HD Master (Strictly 60.0 Seconds · 1800 Frames) */}
      <Composition
        id="BedrockStartupIntro4K"
        component={BedrockStartupIntro}
        durationInFrames={1800}
        fps={30}
        width={3840}
        height={2160}
      />
    </>
  );
};
