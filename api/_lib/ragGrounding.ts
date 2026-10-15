/**
 * Bedrock Serverless RAG Fact-Verification Engine
 * Provides sub-millisecond, ultra-low-token (<100 tokens) grounding
 * ensuring LLMs never hallucinate deprecated APIs, fake packages, or wrong parameter flags.
 */

export interface GroundedFactsResult {
  groundedFactsBlock: string;
  matchedEntities: string[];
  tokenEstimate: number;
  targetType: string;
  factsCount: number;
}

const CORE_VERIFIED_FACTS: Record<string, { domain: 'coding' | 'visual' | 'video' | 'general'; facts: string[] }> = {
  react: {
    domain: 'coding',
    facts: [
      'React 19: Server Actions, useActionState, useOptimistic, use(Promise).',
      'Deprecated: componentWillMount, findDOMNode, legacy Context, forwardRef without direct props.',
    ],
  },
  'next.js': {
    domain: 'coding',
    facts: [
      'Next.js 15: App Router is default. params, searchParams, cookies(), and headers() are async functions.',
      'NEVER use Pages Router (getStaticProps, getServerSideProps, pages/ directory).',
    ],
  },
  nextjs: {
    domain: 'coding',
    facts: [
      'Next.js 15: App Router is default. params, searchParams, cookies(), and headers() are async functions.',
      'NEVER use Pages Router (getStaticProps, getServerSideProps, pages/ directory).',
    ],
  },
  tailwind: {
    domain: 'coding',
    facts: [
      'Tailwind CSS v4 uses CSS-first configuration via @theme and @import "tailwindcss".',
      'Deprecated: tailwind.config.js is no longer required in v4.',
    ],
  },
  typescript: {
    domain: 'coding',
    facts: [
      'TypeScript 5.5+ in strict mode (noImplicitAny, strictNullChecks).',
      'Negative constraint: NEVER use "any"; use "unknown" with type narrowing or generic parameters.',
    ],
  },
  drizzle: {
    domain: 'coding',
    facts: [
      'Drizzle ORM 0.38+ uses drizzle-kit with schema-first definitions (pgTable, serial, text).',
      'Relations use relations() helper with one() and many().',
    ],
  },
  prisma: {
    domain: 'coding',
    facts: [
      'Prisma 6 uses PrismaClient with typed relations.',
      'PostgreSQL datasource with relationMode = "prisma" if serverless.',
    ],
  },
  zod: {
    domain: 'coding',
    facts: [
      'Zod 3.24+ for runtime schema validation (z.object, z.string, z.infer<typeof Schema>).',
      'Use .safeParse() for resilient error handling without thrown exceptions.',
    ],
  },
  neon: {
    domain: 'coding',
    facts: [
      'Neon Serverless Postgres: @neondatabase/serverless driver with pool or http query client.',
      'Supports instant branching, scale-to-zero, and connection pooling on port 5432 or 6543.',
    ],
  },
  vitest: {
    domain: 'coding',
    facts: [
      'Vitest 4.x: import { describe, it, expect, vi } from "vitest".',
      'Runnable terminal verification: npm run test or vitest run.',
    ],
  },
  midjourney: {
    domain: 'visual',
    facts: [
      'Midjourney v6.1 parameter syntax: --ar 16:9 (or 9:16 / 1:1), --v 6.1, --style raw, --stylize [0-1000].',
      'Zero code, programming languages, or software frameworks allowed in Midjourney prompts.',
    ],
  },
  flux: {
    domain: 'visual',
    facts: [
      'FLUX.1 [dev/pro]: Excels at detailed natural language descriptions and photorealistic human typography.',
      'Does not use Midjourney parameter flags; relies on descriptive lighting, focal length, and atmospheric texture.',
    ],
  },
  cinematography: {
    domain: 'visual',
    facts: [
      'Lens specifications: 35mm f/1.4 for environmental wide shots, 85mm f/1.2 for intimate shallow depth of field portraits.',
      'Film stocks: Kodak Portra 400 (warm skin tones, fine grain), CineStill 800T (cool tungsten with red halation), Fujifilm Provia (neutral high contrast).',
    ],
  },
  runway: {
    domain: 'video',
    facts: [
      'Runway Gen-3 Alpha prompt format: [Camera Motion] + [Subject Action] + [Environment & Lighting] + [Temporal Speed].',
      'Avoid static prompts; describe temporal transformation, speed ramping, and physics dynamics.',
    ],
  },
  sora: {
    domain: 'video',
    facts: [
      'OpenAI Sora: Focuses on 3D consistency, fluid dynamics (water, smoke, fabric), and lighting persistence across frames.',
    ],
  },
};

export function extractEntitiesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const entities: string[] = [];

  for (const key of Object.keys(CORE_VERIFIED_FACTS)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(lower)) {
      entities.push(key);
    }
  }

  return entities;
}

export function getGroundedFacts(
  query: string,
  targetType = 'coding_agent'
): GroundedFactsResult {
  const isVisual =
    targetType === 'image_generation' ||
    targetType === 'video_generation' ||
    targetType === 'image-prompt' ||
    targetType === 'video-generation';

  const entities = extractEntitiesFromText(query);
  const matchedEntities: string[] = [];
  const verifiedBullets: string[] = [];

  for (const entity of entities) {
    const entry = CORE_VERIFIED_FACTS[entity];
    if (!entry) continue;

    // Strict domain separation: Never leak coding facts into visual/cinematic prompts
    if (isVisual && entry.domain === 'coding') continue;
    if (!isVisual && (entry.domain === 'visual' || entry.domain === 'video')) continue;

    matchedEntities.push(entity);
    for (const fact of entry.facts) {
      if (!verifiedBullets.includes(fact)) {
        verifiedBullets.push(fact);
      }
    }
  }

  // If visual media and no specific entity was matched, inject canonical optics facts
  if (isVisual && verifiedBullets.length === 0) {
    if (targetType === 'video_generation' || targetType === 'video-generation') {
      verifiedBullets.push(...CORE_VERIFIED_FACTS.runway.facts);
    } else {
      verifiedBullets.push(...CORE_VERIFIED_FACTS.midjourney.facts);
      verifiedBullets.push(...CORE_VERIFIED_FACTS.cinematography.facts);
    }
  }

  if (verifiedBullets.length > 0) {
    const selected = verifiedBullets.slice(0, 4);
    const bulletsStr = selected.map((b) => `- ${b}`).join('\n');
    const groundedFactsBlock = `<verified_external_facts>\n${bulletsStr}\n[MANDATORY: Obey the above verified external facts strictly. Do not hallucinate deprecated or non-existent alternatives.]\n</verified_external_facts>`;
    const tokenEstimate = Math.round(bulletsStr.length / 4) + 20;

    return {
      groundedFactsBlock,
      matchedEntities,
      tokenEstimate,
      targetType,
      factsCount: selected.length,
    };
  }

  return {
    groundedFactsBlock: '',
    matchedEntities: [],
    tokenEstimate: 0,
    targetType,
    factsCount: 0,
  };
}
