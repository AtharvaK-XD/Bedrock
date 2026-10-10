import {makeScene2D, Circle, Rect, Txt, Node, Line} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeInCubic, delay, Vector2} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#06080d');

  const containerRef = createRef<Node>();
  const auraRef = createRef<Circle>();
  const brandRef = createRef<Txt>();
  const taglineRef = createRef<Txt>();
  const ctaBoxRef = createRef<Rect>();

  view.add(
    <Node ref={containerRef}>
      {/* Emerald Energy Shockwave */}
      <Circle
        ref={auraRef}
        size={200}
        fill={'rgba(16, 185, 129, 0.2)'}
        opacity={0}
      />

      {/* Brand Title */}
      <Txt
        ref={brandRef}
        y={-50}
        text={'BEDROCK'}
        fontFamily={'Space Grotesk, Inter, sans-serif'}
        fontSize={88}
        fontWeight={900}
        letterSpacing={8}
        fill={'#ffffff'}
        opacity={0}
      />

      {/* Tagline */}
      <Txt
        ref={taglineRef}
        y={50}
        text={'THE BEDROCK OF INTELLIGENT SOFTWARE'}
        fontFamily={'JetBrains Mono, monospace'}
        fontSize={22}
        fontWeight={700}
        letterSpacing={4}
        fill={'#10b981'}
        opacity={0}
      />

      {/* CTA Button */}
      <Rect
        ref={ctaBoxRef}
        y={140}
        size={[380, 56]}
        radius={28}
        fill={'#10b981'}
        scale={0}
      >
        <Txt
          text={'DOWNLOAD FOR macOS & WINDOWS'}
          fontFamily={'Space Grotesk, sans-serif'}
          fontSize={16}
          fontWeight={800}
          letterSpacing={1.5}
          fill={'#06080d'}
        />
      </Rect>
    </Node>
  );

  yield* all(
    auraRef().opacity(1, 1),
    auraRef().size(800, 1.5, easeOutBack),
    brandRef().opacity(1, 1, easeInOutCubic),
    taglineRef().opacity(1, 1.2, easeInOutCubic),
  );

  yield* ctaBoxRef().scale(1, 0.6, easeOutBack);

  yield* delay(2);
});
