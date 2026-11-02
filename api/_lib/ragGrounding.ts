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

/**
 * One topic's facts. Every entry says WHEN it was last checked and AGAINST WHAT, so stale facts can be
 * found and a test can fail once they are old (groundedFacts.test.ts). A fact that could not be confirmed
 * is marked `unverified` with the reason instead of pretending.
 *
 * To refresh: check each claim (npm registry: `npm view <package> version`, endoflife.date for runtimes
 * and databases, the vendor's own docs for tools), edit the text, and set `verified` to today.
 */
export interface VerifiedFactEntry {
  domain: 'coding' | 'visual' | 'video' | 'general';
  facts: string[];
  /** Date (YYYY-MM-DD) the facts were last checked. */
  verified: string;
  /** What it was checked against. */
  basis: string;
  /** Set when the facts could not be confirmed; the reason goes in `basis`. Exempt from the age check, but listed by the test. */
  unverified?: boolean;
}

const NEXTJS_FACTS = [
  'Next.js 16 (15 and newer): App Router is default. params, searchParams, cookies(), and headers() are async functions.',
  'NEVER use Pages Router (getStaticProps, getServerSideProps, pages/ directory).',
];

export const CORE_VERIFIED_FACTS: Record<string, VerifiedFactEntry> = {
  react: {
    domain: 'coding',
    facts: [
      'React 19: Server Actions, useActionState, useOptimistic, use(Promise).',
      'Deprecated: componentWillMount, findDOMNode, legacy Context, forwardRef without direct props.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: react 19.3.1',
  },
  'next.js': {
    domain: 'coding',
    facts: NEXTJS_FACTS,
    verified: '2026-11-02',
    basis: 'npm registry: next 16.4.3',
  },
  nextjs: {
    domain: 'coding',
    facts: NEXTJS_FACTS,
    verified: '2026-11-02',
    basis: 'npm registry: next 16.4.3',
  },
  tailwind: {
    domain: 'coding',
    facts: [
      'Tailwind CSS v4 uses CSS-first configuration via @theme and @import "tailwindcss".',
      'Deprecated: tailwind.config.js is no longer required in v4.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: tailwindcss 4.3.3',
  },
  typescript: {
    domain: 'coding',
    facts: [
      'TypeScript 5.5 or newer in strict mode (noImplicitAny, strictNullChecks).',
      'Negative constraint: NEVER use "any"; use "unknown" with type narrowing or generic parameters.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: typescript 7.0.2 (5.5+ is still a valid minimum)',
  },
  drizzle: {
    domain: 'coding',
    facts: [
      'Drizzle ORM 0.38+ uses drizzle-kit with schema-first definitions (pgTable, serial, text).',
      'Relations use relations() helper with one() and many().',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: drizzle-orm 0.45.4, drizzle-kit 0.31.11',
  },
  prisma: {
    domain: 'coding',
    facts: [
      'Prisma 7 (current stable; 8 is a release candidate) uses PrismaClient with typed relations.',
      'PostgreSQL datasource; for serverless, use a pooled connection string.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: prisma latest tag 8.0.0-rc.29, previous stable 7.10.1. An old serverless line about the Prisma relation mode was removed: that setting is for databases without foreign keys, not for serverless Postgres',
  },
  zod: {
    domain: 'coding',
    facts: [
      'Zod 4 for runtime schema validation (z.object, z.string, z.infer<typeof Schema>).',
      'Use .safeParse() for resilient error handling without thrown exceptions.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: zod 4.6.7',
  },
  neon: {
    domain: 'coding',
    facts: [
      'Neon Serverless Postgres: @neondatabase/serverless driver with pool or http query client.',
      'Supports instant branching, scale-to-zero, and connection pooling through the "-pooler" hostname of the connection string.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: @neondatabase/serverless 1.2.0; pooled "-pooler" host matches this project\'s own Neon connection. An old pooling-port line was removed: its second port is Supabase\'s pooler port, not Neon\'s',
  },
  vitest: {
    domain: 'coding',
    facts: [
      'Vitest 5.x: import { describe, it, expect, vi } from "vitest".',
      'Runnable terminal verification: npm run test or vitest run.',
    ],
    verified: '2026-11-02',
    basis: 'npm registry: vitest 5.0.5',
  },
  midjourney: {
    domain: 'visual',
    facts: [
      'Midjourney parameter syntax: --ar 16:9 (or 9:16 / 1:1), --style raw, --stylize [0-1000]. Midjourney uses its current default model unless --v <version> is given: add --v only when the user names a version.',
      'Zero code, programming languages, or software frameworks allowed in Midjourney prompts.',
    ],
    verified: '2026-11-02',
    basis: 'Version-free on purpose: web sources name V8.x as the current default but disagree on details, so no version number is stated',
  },
  flux: {
    domain: 'visual',
    facts: [
      'FLUX models (FLUX.1, FLUX.2 and newer): Excel at detailed natural language descriptions and photorealistic human typography.',
      'Does not use Midjourney parameter flags; relies on descriptive lighting, focal length, and atmospheric texture.',
    ],
    verified: '2026-11-02',
    basis: 'Family-level behavior only. Web sources disagree on whether FLUX.2 or FLUX.3 is newest, so no single version is named',
  },
  cinematography: {
    domain: 'visual',
    facts: [
      'Lens specifications: 35mm f/1.4 for environmental wide shots, 85mm f/1.2 for intimate shallow depth of field portraits.',
      'Film stocks: Kodak Portra 400 (warm skin tones, fine grain), CineStill 800T (cool tungsten with red halation), Fujifilm Provia (neutral high contrast).',
    ],
    verified: '2026-11-02',
    basis: 'Photography facts with no software versions in them',
  },
  runway: {
    domain: 'video',
    facts: [
      'Runway prompt format: [Camera Motion] + [Subject Action] + [Environment & Lighting] + [Temporal Speed].',
      'Avoid static prompts; describe temporal transformation, speed ramping, and physics dynamics.',
    ],
    verified: '2026-11-02',
    basis: 'Runway help center names Gen-4.5 as its latest model. The prompt structure comes from earlier Runway guides and was not re-checked against Gen-4.5',
  },
  sora: {
    domain: 'video',
    facts: [
      'OpenAI Sora: Focuses on 3D consistency, fluid dynamics (water, smoke, fabric), and lighting persistence across frames.',
    ],
    verified: '2026-11-02',
    unverified: true,
    basis: 'Wikipedia (via web search) reports OpenAI discontinued Sora in 2026 (app shut down April, API September) while other sites describe newer Sora versions. Not confirmed with OpenAI: check before relying on this entry',
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
