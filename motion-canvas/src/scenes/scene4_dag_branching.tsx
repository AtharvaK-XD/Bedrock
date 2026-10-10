import {makeScene2D, Circle, Rect, Txt, Node, Line} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeInCubic, delay, Vector2} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#06080d');

  const containerRef = createRef<Node>();
  const headlineRef = createRef<Txt>();

  const rootNodeRef = createRef<Rect>();
  const branchARef = createRef<Rect>();
  const branchBRef = createRef<Rect>();
  const branchCRef = createRef<Rect>();

  view.add(
    <Node ref={containerRef}>
      <Txt
        ref={headlineRef}
        y={-260}
        text={'INFINITE VISUAL DAG CANVAS · TACTILE PHYSICS'}
        fontFamily={'Space Grotesk, Inter, sans-serif'}
        fontSize={36}
        fontWeight={800}
        letterSpacing={2}
        fill={'#f8fafc'}
        opacity={0}
      />

      {/* Root Node */}
      <Rect
        ref={rootNodeRef}
        x={-340}
        y={0}
        size={[180, 72]}
        radius={16}
        fill={'#0a0f18'}
        stroke={'#10b981'}
        lineWidth={2}
        scale={0}
      >
        <Txt
          text={'ROOT INTENT'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={15}
          fontWeight={700}
          fill={'#10b981'}
        />
      </Rect>

      {/* Connecting Lines */}
      <Line
        points={[new Vector2(-250, 0), new Vector2(0, -110)]}
        stroke={'rgba(16, 185, 129, 0.4)'}
        lineWidth={3}
      />
      <Line
        points={[new Vector2(-250, 0), new Vector2(0, 0)]}
        stroke={'rgba(56, 189, 248, 0.4)'}
        lineWidth={3}
      />
      <Line
        points={[new Vector2(-250, 0), new Vector2(0, 110)]}
        stroke={'rgba(236, 72, 153, 0.4)'}
        lineWidth={3}
      />

      {/* Branch A */}
      <Rect
        ref={branchARef}
        x={120}
        y={-110}
        size={[220, 64]}
        radius={14}
        fill={'#0a0f18'}
        stroke={'#10b981'}
        lineWidth={2}
        scale={0}
      >
        <Txt
          text={'BRANCH A: ZERO-SHOT'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={14}
          fontWeight={700}
          fill={'#f8fafc'}
        />
      </Rect>

      {/* Branch B */}
      <Rect
        ref={branchBRef}
        x={120}
        y={0}
        size={[220, 64]}
        radius={14}
        fill={'#0a0f18'}
        stroke={'#38bdf8'}
        lineWidth={2}
        scale={0}
      >
        <Txt
          text={'BRANCH B: MULTI-PASS'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={14}
          fontWeight={700}
          fill={'#f8fafc'}
        />
      </Rect>

      {/* Branch C */}
      <Rect
        ref={branchCRef}
        x={120}
        y={110}
        size={[220, 64]}
        radius={14}
        fill={'#0a0f18'}
        stroke={'#ec4899'}
        lineWidth={2}
        scale={0}
      >
        <Txt
          text={'BRANCH C: CONSTRAINED'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={14}
          fontWeight={700}
          fill={'#f8fafc'}
        />
      </Rect>
    </Node>
  );

  yield* all(
    headlineRef().opacity(1, 0.8, easeInOutCubic),
    rootNodeRef().scale(1, 0.8, easeOutBack),
  );

  yield* all(
    branchARef().scale(1, 0.6, easeOutBack),
    delay(0.15, branchBRef().scale(1, 0.6, easeOutBack)),
    delay(0.3, branchCRef().scale(1, 0.6, easeOutBack)),
  );

  yield* delay(1.5);

  yield* all(
    containerRef().scale(0.85, 0.8, easeInCubic),
    containerRef().opacity(0, 0.8, easeInCubic),
  );
});
