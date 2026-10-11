import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, HIT_FRAMES, LAYOUT_ZONES, SPRINGS } from '../components/MotionTokens';
import { SceneChrome } from '../components/SceneChrome';
import { GhostCursor, CursorWaypoint } from '../components/GhostCursor';
import { CameraRig, FlashOverlay } from '../components/Transitions';

const WindowsLogo: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 88 88" fill={color}>
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.202zm35.67 33.529l.028 34.453L0 75.58v-29.43zm4.326-39.027L87.914 0v41.527l-47.918.378zm47.918 43.625l-.014 41.471-47.904-6.744v-34.78z" />
  </svg>
);

const AppleLogo: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 170 170" fill={color}>
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.73-14.19-5.99-9.35-10.74-20.2-14.25-32.55-3.51-12.35-5.27-24.08-5.27-35.18 0-14.68 3.73-26.68 11.19-36 7.46-9.31 16.73-14.07 27.81-14.27 4.9 0 10.42 1.25 16.56 3.75 6.14 2.5 10.15 3.79 12.04 3.86 1.48 0 5.66-1.39 12.56-4.16 6.9-2.78 12.7-3.95 17.4-3.52 13.51 1.07 24.16 6.36 31.95 15.86-11.97 7.24-17.84 17.3-17.62 30.17.21 10.22 4.1 18.73 11.66 25.53 7.56 6.8 16.64 10.59 27.24 11.37-2.58 8.04-5.83 16.14-9.76 24.31zM119.22 31.84c0-7.39 2.66-14.28 7.97-20.67 5.32-6.39 11.83-10.45 19.55-12.17.64 1.71.96 3.42.96 5.13 0 7.39-2.77 14.33-8.31 20.84-5.54 6.5-12.18 10.4-19.92 11.7-.1-.95-.25-2.57-.25-4.83z" />
  </svg>
);

export const Scene6MonolithicFinale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Act 6 Spans Global Frames 3114 to 3600 (Duration: 486 frames)
  // Scene 15: 0 - 90 (Global 3114 - 3204) "Stop guessing." (Hit 3 at 52.0s = frame 6)
  // Scene 16: 90 - 203 (Global 3204 - 3317) "Start engineering." (Hit 4 at 53.75s = frame 111)
  // Scene 17: 203 - 486 (Global 3317 - 3600) End Card "Bedrock" (Hit 5 at 55.28s = frame 203)

  const isScene15 = frame < 90;
  const isScene16 = frame >= 90 && frame < 203;
  const isScene17 = frame >= 203;

  const s15Frame = frame;
  const s16Frame = Math.max(0, frame - 90);
  const s17Frame = Math.max(0, frame - 203);

  // ==========================================================================
  // SCENE 15 ANIMATIONS (0 - 90, Hit 3 at Frame 6 = Global 3120 = 52.00s)
  // ==========================================================================
  // Z6 Crash zoom: 2.2 -> 1.0 in 10 frames
  const s15CrashZoom = interpolate(s15Frame, [0, 10], [2.2, 1.0], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s15Blur = interpolate(s15Frame, [0, 8], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dissolve to particles after 42 frames (700ms)
  const isS15Dissolve = s15Frame >= 48;
  const s15DissolveOpacity = isS15Dissolve
    ? Math.max(0, 1 - (s15Frame - 48) / 36)
    : 1;

  // ==========================================================================
  // SCENE 16 ANIMATIONS (90 - 203, Hit 4 at Frame 111 = Global 3225 = 53.75s)
  // ==========================================================================
  // Z6 Crash zoom landing on Hit 4
  const s16CrashZoom = interpolate(s16Frame, [10, 24], [2.2, 1.08], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s16Blur = interpolate(s16Frame, [10, 22], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s16Underline = interpolate(s16Frame, [20, 44], [0, 100], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Calm hold of 36 frames (600ms) before Z8 cut at frame 198
  const isZ8Cut = s16Frame >= 195;
  const s16CutBlur = isZ8Cut
    ? interpolate(s16Frame, [195, 203], [0, 30], { extrapolateRight: 'clamp' })
    : 0;

  // ==========================================================================
  // SCENE 17 ANIMATIONS (203 - 486, Hit 5 at Frame 203 = Global 3317 = 55.28s)
  // ==========================================================================
  // FIX R5: Logo Slam lands on frame 0 of Scene 17 (Global 3317 = 55.28s)!
  // W10 Bottom-sheet rise with rubber-band 24px overshoot (contained bounds)
  const s17CardSpring = spring({
    frame: s17Frame,
    fps,
    config: { stiffness: 140, damping: 18 },
  });
  const s17CardY = interpolate(s17CardSpring, [0, 1], [160, 0]);

  // Expanding shockwave ring on Hit 5
  const s17RingScale = interpolate(s17Frame, [0, 45], [0.8, 3.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s17RingOpacity = interpolate(s17Frame, [0, 45], [0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Mint horizon arc rising behind
  const horizonArcOpacity = interpolate(s17Frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // W4 Ghost Cursor glides to "Download for Windows" button and clicks at frame 63 (Global 3380)
  const cursorWaypointsEndCard: CursorWaypoint[] = [
    { frame: 20, x: 960, y: 840 },
    { frame: 63, x: 785, y: 678, isClick: true },
    { frame: 120, x: 785, y: 678 },
  ];

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Flash Overlays on Hit 3 (52.0s), Hit 4 (53.75s), and Hit 5 (55.28s) */}
      <FlashOverlay triggerFrame={HIT_FRAMES.HIT_3} duration={5} />
      <FlashOverlay triggerFrame={HIT_FRAMES.HIT_4} duration={5} />
      <FlashOverlay triggerFrame={HIT_FRAMES.HIT_5} duration={6} />

      <CameraRig sceneFrame={frame} sceneDuration={486} globalFrame={frame + 3114}>
        {/* ================================================================== */}
        {/* SCENE CHROME                                                       */}
        {/* ================================================================== */}
        {isScene15 && (
          <SceneChrome
            eyebrow="THE PAST"
            headline="Stop guessing."
            caption="Stop guessing."
            keyWord="Stop"
            sceneFrame={s15Frame}
            sceneDuration={90}
            hideHeadline
            hideCaption
          />
        )}
        {isScene16 && (
          <SceneChrome
            eyebrow="THE FUTURE"
            headline="Start engineering."
            caption="Start engineering."
            keyWord="engineering."
            sceneFrame={s16Frame}
            sceneDuration={113}
            hideHeadline
            hideCaption
          />
        )}
        {isScene17 && (
          <SceneChrome
            eyebrow="PRODUCTION RELEASE"
            headline="Bedrock"
            caption="The bedrock of intelligent software."
            keyWord="Bedrock"
            sceneFrame={s17Frame}
            sceneDuration={283}
            hideHeadline
            hideCaption
          />
        )}

        {/* Ghost Cursor Interaction in Scene 17 (W4) */}
        {isScene17 && (
          <GhostCursor sceneFrame={s17Frame} waypoints={cursorWaypointsEndCard} />
        )}

        {/* ================================================================== */}
        {/* 💥 SCENE 15: "Stop guessing."                                      */}
        {/* ================================================================== */}
        {isScene15 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${s15CrashZoom})`,
              filter: `blur(${s15Blur}px)`,
              opacity: s15DissolveOpacity,
            }}
          >
            <h1
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '110px',
                fontWeight: 800,
                color: COLORS.white,
                letterSpacing: '-0.04em',
                margin: 0,
                textShadow: '0 0 50px rgba(255, 255, 255, 0.4)',
              }}
            >
              Stop guessing.
            </h1>
          </div>
        )}

        {/* ================================================================== */}
        {/* 🚀 SCENE 16: "Start engineering."                                  */}
        {/* ================================================================== */}
        {isScene16 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${s16CrashZoom})`,
              filter: `blur(${s16Blur + s16CutBlur}px)`,
            }}
          >
            <div style={{ position: 'relative' }}>
              <h1
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '118px', // Larger by 8% than scene 15
                  fontWeight: 800,
                  color: COLORS.white,
                  letterSpacing: '-0.04em',
                  margin: 0,
                  textShadow: '0 0 60px rgba(16, 185, 129, 0.55)',
                }}
              >
                Start engineering.
              </h1>
              {/* Mint Underline drawing left -> right */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '-10px',
                  height: '4px',
                  width: `${s16Underline}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.9)',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 🏆 SCENE 17: END CARD "Bedrock" (FIX R5: Slam on 55.28s)           */}
        {/* ================================================================== */}
        {isScene17 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Mint Horizon Arc behind end card */}
            <div
              style={{
                position: 'absolute',
                bottom: '-20%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '160%',
                height: '450px',
                background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.18) 0%, transparent 70%)',
                filter: 'blur(50px)',
                opacity: horizonArcOpacity,
                pointerEvents: 'none',
              }}
            />

            {/* Shockwave Ring centered at Logo (960, 320) on Hit 5 */}
            <div
              style={{
                position: 'absolute',
                top: '320px',
                left: '960px',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                border: `2.5px solid ${COLORS.mint}`,
                boxShadow: '0 0 45px rgba(16, 185, 129, 0.85)',
                transform: `translate(-50%, -50%) scale(${s17RingScale})`,
                opacity: s17RingOpacity,
                pointerEvents: 'none',
              }}
            />

            {/* W10 Bottom Sheet Lifting Card */}
            <div
              style={{
                transform: `translateY(${s17CardY}px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '28px',
                zIndex: 30,
              }}
            >
              {/* Monolithic Logo Badge */}
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '34px',
                  background: 'radial-gradient(circle at 35% 30%, #162622 0%, #08110f 100%)',
                  border: `2px solid ${COLORS.mintBorder}`,
                  boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 50px rgba(16, 185, 129, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(30px)',
                }}
              >
                <Img
                  src={staticFile('logo.png')}
                  style={{
                    width: '94px',
                    height: '94px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 24px rgba(52, 211, 153, 0.85))',
                  }}
                />
              </div>

              {/* Title & Tagline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <h1
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '84px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: COLORS.white,
                    margin: 0,
                    textShadow: '0 0 40px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  Bedrock
                </h1>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '24px',
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    color: COLORS.textMuted,
                    margin: 0,
                  }}
                >
                  The bedrock of intelligent software.
                </p>
              </div>

              {/* Download for Windows & Mac Action Box */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(8, 12, 16, 0.92)',
                  border: `1.5px solid ${COLORS.mintBorder}`,
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(30px)',
                }}
              >
                {/* Download for Windows Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    width: '330px',
                    padding: '12px 24px',
                    borderRadius: '14px',
                    background: s17Frame >= 63 && s17Frame <= 75
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.25) 100%)'
                      : 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.12) 100%)',
                    border: `1px solid ${COLORS.mintBorder}`,
                    boxShadow: s17Frame >= 63 && s17Frame <= 75
                      ? '0 0 25px rgba(16, 185, 129, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      : '0 0 18px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    transform: s17Frame >= 63 && s17Frame <= 75 ? 'scale(0.97)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <WindowsLogo size={24} color={COLORS.mint} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '18px',
                        fontWeight: 700,
                        color: COLORS.white,
                        letterSpacing: '-0.01em',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Download for Windows
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px',
                        fontWeight: 600,
                        color: COLORS.mint,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Windows 10/11 · .exe
                    </span>
                  </div>
                </div>

                {/* Subtle Divider */}
                <div
                  style={{
                    width: '1px',
                    height: '36px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  }}
                />

                {/* Download for Mac Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    width: '330px',
                    padding: '12px 24px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <AppleLogo size={24} color={COLORS.white} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '18px',
                        fontWeight: 700,
                        color: COLORS.white,
                        letterSpacing: '-0.01em',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Download for Mac
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px',
                        fontWeight: 600,
                        color: COLORS.textMuted,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      macOS 12+ · .dmg
                    </span>
                  </div>
                </div>
              </div>

              {/* Version & OS Subtitle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  fontSize: '18px',
                  color: COLORS.textDim,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                }}
              >
                <span>WINDOWS & macOS</span>
                <span>•</span>
                <span style={{ color: COLORS.mint }}>v1.2.4</span>
              </div>
            </div>
          </div>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};
