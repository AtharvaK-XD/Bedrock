import {makeScene2D, Circle, Rect, Txt, Node, Line} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeInCubic, chain, delay} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#06080d');

  const titleRef = createRef<Txt>();
  const subtitleRef = createRef<Txt>();
  const containerRef = createRef<Node>();
  const coreRef = createRef<Rect>();
  const auraRef = createRef<Circle>();

  view.add(
    <Node ref={containerRef}>
      {/* Background radial glow */}
      <Circle
        ref={auraRef}
        size={200}
        fill={'rgba(16, 185, 129, 0.12)'}
        opacity={0}
      />

      {/* Central Monolithic Seed */}
      <Rect
        ref={coreRef}
        size={[120, 120]}
        radius={24}
        fill={'#0a0f18'}
        stroke={'#10b981'}
        lineWidth={3}
        scale={0}
        rotation={45}
      />

      {/* Main Kinetic Title */}
      <Txt
        ref={titleRef}
        y={-140}
        text={'PROMPT DECAY IS REAL'}
        fontFamily={'Space Grotesk, Inter, sans-serif'}
        fontSize={64}
        fontWeight={800}
        fill={'#f8fafc'}
        opacity={0}
      />

      {/* Subtitle */}
      <Txt
        ref={subtitleRef}
        y={150}
        text={'ENGINEERING AI IS SOFTWARE ARCHITECTURE'}
        fontFamily={'JetBrains Mono, monospace'}
        fontSize={24}
        fontWeight={700}
        letterSpacing={4}
        fill={'#10b981'}
        opacity={0}
      />
    </Node>
  );

  // Animation sequence
  yield* all(
    titleRef().opacity(1, 1.2, easeInOutCubic),
    titleRef().y(-100, 1.2, easeOutBack),
    subtitleRef().opacity(1, 1.5, easeInOutCubic),
  );

  yield* delay(0.5);

  yield* all(
    coreRef().scale(1.2, 1.5, easeOutBack),
    coreRef().rotation(0, 1.5, easeInOutCubic),
    auraRef().opacity(1, 1),
    auraRef().size(600, 1.5, easeInOutCubic),
  );

  yield* delay(1);

  // Transition out
  yield* all(
    containerRef().scale(1.4, 0.8, easeInCubic),
    containerRef().opacity(0, 0.8, easeInCubic),
  );
});
