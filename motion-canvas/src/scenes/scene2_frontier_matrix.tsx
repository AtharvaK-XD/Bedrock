import {makeScene2D, Circle, Rect, Txt, Node, Line} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeInCubic, delay, Vector2} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#06080d');

  const containerRef = createRef<Node>();
  const headlineRef = createRef<Txt>();
  const sublineRef = createRef<Txt>();

  const models = [
    { name: 'Claude 3.7 Sonnet', pos: [-360, -90], color: '#d97706' },
    { name: 'GPT-4.5 Orion', pos: [0, -140], color: '#10b981' },
    { name: 'Gemini 2.0 Flash', pos: [360, -90], color: '#3b82f6' },
    { name: 'DeepSeek R1', pos: [-240, 110], color: '#6366f1' },
    { name: 'Grok 3', pos: [240, 110], color: '#ec4899' },
  ];

  const nodeRefs = models.map(() => createRef<Rect>());

  view.add(
    <Node ref={containerRef}>
      <Txt
        ref={headlineRef}
        y={-280}
        text={'10 FRONTIER MODELS · ZERO VENDOR LOCK-IN'}
        fontFamily={'Space Grotesk, Inter, sans-serif'}
        fontSize={40}
        fontWeight={800}
        letterSpacing={2}
        fill={'#f8fafc'}
        opacity={0}
      />
      <Txt
        ref={sublineRef}
        y={-230}
        text={'ONE UNIFIED WORKSTATION TELEMETRY ENGINE'}
        fontFamily={'JetBrains Mono, monospace'}
        fontSize={18}
        fontWeight={700}
        letterSpacing={3}
        fill={'#10b981'}
        opacity={0}
      />

      {/* Connection Lines from Center */}
      {models.map((m, i) => (
        <Line
          key={`line-${i}`}
          points={[new Vector2(0, 0), new Vector2(m.pos[0], m.pos[1])]}
          stroke={'rgba(16, 185, 129, 0.25)'}
          lineWidth={2}
          lineDash={[6, 6]}
        />
      ))}

      {/* Model Cards */}
      {models.map((m, i) => (
        <Rect
          key={`node-${i}`}
          ref={nodeRefs[i]}
          x={m.pos[0]}
          y={m.pos[1]}
          size={[220, 64]}
          radius={16}
          fill={'#0a0f18'}
          stroke={m.color}
          lineWidth={2}
          scale={0}
        >
          <Txt
            text={m.name}
            fontFamily={'Space Grotesk, sans-serif'}
            fontSize={17}
            fontWeight={700}
            fill={'#f8fafc'}
          />
        </Rect>
      ))}

      {/* Central Hub */}
      <Circle
        size={80}
        fill={'#10b981'}
        stroke={'#ffffff'}
        lineWidth={3}
      >
        <Txt
          text={'CORE'}
          fontFamily={'JetBrains Mono, monospace'}
          fontSize={15}
          fontWeight={800}
          fill={'#06080d'}
        />
      </Circle>
    </Node>
  );

  // Entrance
  yield* all(
    headlineRef().opacity(1, 1, easeInOutCubic),
    sublineRef().opacity(1, 1.2, easeInOutCubic),
    ...nodeRefs.map((ref, idx) => delay(idx * 0.1, ref().scale(1, 0.8, easeOutBack))),
  );

  yield* delay(1.5);

  // Outro
  yield* all(
    containerRef().scale(0.8, 0.8, easeInCubic),
    containerRef().opacity(0, 0.8, easeInCubic),
  );
});
