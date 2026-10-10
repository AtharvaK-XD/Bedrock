import {makeScene2D, Circle, Rect, Txt, Node, Line} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeInCubic, delay, Vector2} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#06080d');

  const containerRef = createRef<Node>();
  const headlineRef = createRef<Txt>();
  const sublineRef = createRef<Txt>();

  const frameworks = [
    'LangChain', 'LlamaIndex', 'OpenAI SDK', 'Anthropic SDK',
    'Vercel AI SDK', 'Google GenAI', 'Rust Crates', 'Python Async'
  ];

  const fwRefs = frameworks.map(() => createRef<Rect>());

  view.add(
    <Node ref={containerRef}>
      <Txt
        ref={headlineRef}
        y={-240}
        text={'ARENA BENCHMARKS & 15 TARGET EXPORTERS'}
        fontFamily={'Space Grotesk, Inter, sans-serif'}
        fontSize={38}
        fontWeight={800}
        letterSpacing={2}
        fill={'#f8fafc'}
        opacity={0}
      />
      <Txt
        ref={sublineRef}
        y={-190}
        text={'HARDENED DIRECTIVES READY FOR PRODUCTION DEPLOYMENT'}
        fontFamily={'JetBrains Mono, monospace'}
        fontSize={16}
        fontWeight={700}
        letterSpacing={3}
        fill={'#10b981'}
        opacity={0}
      />

      {/* Grid of Framework Badges */}
      {frameworks.map((name, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const xPos = -360 + col * 240;
        const yPos = -60 + row * 110;

        return (
          <Rect
            key={`fw-${i}`}
            ref={fwRefs[i]}
            x={xPos}
            y={yPos}
            size={[210, 68]}
            radius={16}
            fill={'#0a0f18'}
            stroke={'rgba(16, 185, 129, 0.45)'}
            lineWidth={1.5}
            scale={0}
          >
            <Txt
              text={name}
              fontFamily={'Space Grotesk, sans-serif'}
              fontSize={17}
              fontWeight={700}
              fill={'#f8fafc'}
            />
          </Rect>
        );
      })}
    </Node>
  );

  yield* all(
    headlineRef().opacity(1, 0.8, easeInOutCubic),
    sublineRef().opacity(1, 1, easeInOutCubic),
    ...fwRefs.map((ref, idx) => delay(idx * 0.08, ref().scale(1, 0.6, easeOutBack))),
  );

  yield* delay(1.6);

  yield* all(
    containerRef().scale(1.2, 0.8, easeInCubic),
    containerRef().opacity(0, 0.8, easeInCubic),
  );
});
