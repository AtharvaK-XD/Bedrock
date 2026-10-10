import {makeScene2D, Circle, Rect, Txt, Node, Line} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeInCubic, delay, Vector2} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#06080d');

  const containerRef = createRef<Node>();
  const headlineRef = createRef<Txt>();
  const codeBoxRef = createRef<Rect>();
  const tag1Ref = createRef<Rect>();
  const tag2Ref = createRef<Rect>();
  const tag3Ref = createRef<Rect>();

  view.add(
    <Node ref={containerRef}>
      <Txt
        ref={headlineRef}
        y={-240}
        text={'NEURAL PROMPT SYNTHESIS ENGINE'}
        fontFamily={'Space Grotesk, Inter, sans-serif'}
        fontSize={38}
        fontWeight={800}
        letterSpacing={2}
        fill={'#f8fafc'}
        opacity={0}
      />

      {/* Code / Directives Window */}
      <Rect
        ref={codeBoxRef}
        y={20}
        size={[720, 260]}
        radius={18}
        fill={'#0a0f18'}
        stroke={'rgba(16, 185, 129, 0.4)'}
        lineWidth={2}
        scale={0}
      >
        <Txt
          x={-300}
          y={-90}
          text={'// COMPILED SYSTEM DIRECTIVE · SHA-256 VERIFIED'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={15}
          fill={'#64748b'}
        />
        <Txt
          x={-140}
          y={-40}
          text={'<context>Production Hardened Prompt</context>'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={18}
          fill={'#10b981'}
        />
        <Txt
          x={-160}
          y={10}
          text={'<target>image_generation / zero_coding</target>'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={18}
          fill={'#38bdf8'}
        />
        <Txt
          x={-130}
          y={60}
          text={'<directive strict="true">No hallucinations</directive>'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={18}
          fill={'#f59e0b'}
        />
      </Rect>

      {/* Feature Badges Below */}
      <Rect
        ref={tag1Ref}
        x={-240}
        y={200}
        size={[200, 48]}
        radius={12}
        fill={'rgba(16, 185, 129, 0.15)'}
        stroke={'#10b981'}
        lineWidth={1.5}
        scale={0}
      >
        <Txt
          text={'MULTI-PASS REASONING'}
          fontFamily={'Space Grotesk, sans-serif'}
          fontSize={13}
          fontWeight={700}
          fill={'#10b981'}
        />
      </Rect>

      <Rect
        ref={tag2Ref}
        x={0}
        y={200}
        size={[200, 48]}
        radius={12}
        fill={'rgba(56, 189, 248, 0.15)'}
        stroke={'#38bdf8'}
        lineWidth={1.5}
        scale={0}
      >
        <Txt
          text={'SCHEMA VALIDATION'}
          fontFamily={'Space Grotesk, sans-serif'}
          fontSize={13}
          fontWeight={700}
          fill={'#38bdf8'}
        />
      </Rect>

      <Rect
        ref={tag3Ref}
        x={240}
        y={200}
        size={[200, 48]}
        radius={12}
        fill={'rgba(236, 72, 153, 0.15)'}
        stroke={'#ec4899'}
        lineWidth={1.5}
        scale={0}
      >
        <Txt
          text={'ZERO-CODING ARCHETYPES'}
          fontFamily={'Space Grotesk, sans-serif'}
          fontSize={13}
          fontWeight={700}
          fill={'#ec4899'}
        />
      </Rect>
    </Node>
  );

  // Animations
  yield* all(
    headlineRef().opacity(1, 0.8, easeInOutCubic),
    codeBoxRef().scale(1, 1, easeOutBack),
  );

  yield* all(
    tag1Ref().scale(1, 0.6, easeOutBack),
    delay(0.15, tag2Ref().scale(1, 0.6, easeOutBack)),
    delay(0.3, tag3Ref().scale(1, 0.6, easeOutBack)),
  );

  yield* delay(1.5);

  yield* all(
    containerRef().scale(1.2, 0.8, easeInCubic),
    containerRef().opacity(0, 0.8, easeInCubic),
  );
});
