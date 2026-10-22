import { z } from 'zod';
import {
  CODING_AGENT_MASTER_PROMPT,
  IMAGE_GENERATION_MASTER_PROMPT,
  VIDEO_GENERATION_MASTER_PROMPT,
  FREELANCER_BRIEF_MASTER_PROMPT,
  HACKATHON_PITCH_MASTER_PROMPT,
  NO_CODE_MASTER_PROMPT,
  WRITING_MASTER_PROMPT,
} from './masterRolePrompts.js';

export type UseCaseProfileId =
  | 'coding-agent'
  | 'image-prompt'
  | 'writing'
  | 'freelance-brief'
  | 'pitch'
  | 'video-generation'
  | 'no-code';

export interface QuestionOutput {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface FewShotExample {
  title: string;
  inputIdea: string;
  clarifyingQuestions: Array<{
    id: string;
    questionText: string;
    questionType: 'single_select' | 'multi_select' | 'free_text';
    options?: string[];
    sampleAnswer: string | string[];
  }>;
  synthesizedOutputSnippet: string;
}

export interface UseCaseProfile {
  id: UseCaseProfileId;
  name: string;
  tag: string;
  badgeColor: string;
  description: string;
  aliases: string[];
  temperature: number;
  forbiddenTerms: string[];
  questionPrompt: string;
  synthesisPrompt: string;
  zodOutputSchema: z.ZodType<any>;
  fewShotExamples: FewShotExample[];
  fallbackQuestions: QuestionOutput[];
}

// ----------------- Output Zod Schemas -----------------

export const QuestionItemSchema = z.object({
  id: z.string().min(1),
  questionText: z.string().min(3),
  questionType: z.enum(['single_select', 'multi_select', 'free_text']),
  options: z.array(z.string()).optional(),
});

export const QuestionsArraySchema = z.array(QuestionItemSchema).min(2).max(6);

export const CodingAgentOutputSchema = z.object({
  questions: QuestionsArraySchema,
  synthesis: z.string().min(100),
});

export const ImagePromptOutputSchema = z.object({
  questions: QuestionsArraySchema,
  synthesis: z.string().min(80),
});

export const WritingOutputSchema = z.object({
  questions: QuestionsArraySchema,
  synthesis: z.string().min(100),
});

export const FreelanceBriefOutputSchema = z.object({
  questions: QuestionsArraySchema,
  synthesis: z.string().min(100),
});

export const PitchOutputSchema = z.object({
  questions: QuestionsArraySchema,
  synthesis: z.string().min(100),
});

// ----------------- Profiles Configuration -----------------

export const USE_CASE_PROFILES: Record<UseCaseProfileId, UseCaseProfile> = {
  'coding-agent': {
    id: 'coding-agent',
    name: 'Coding Agent',
    tag: 'DEV',
    badgeColor: 'emerald',
    description: 'Autonomous coding agents (Cursor, Windsurf, Claude Code, Copilot) with strict architectural boundaries, explicit file topologies, concrete schemas, and automated verification.',
    aliases: ['coding_agent', 'coding-agent', 'dev', 'developer', 'full_stack', 'cli_tool'],
    temperature: 0.2,
    forbiddenTerms: [
      'any',
      '// TODO',
      '/* TODO */',
      '/* implement later */',
      '// add logic here',
      'as any',
      'placeholder',
      'loose types',
      'mock implementation',
      'unhandled rejection',
      'empty catch',
      'magic strings',
      'synchronous blocking loop',
    ],
    questionPrompt: `You are Bedrock's Principal Coding Agent Architect.
Your task is to analyze the user's software engineering concept and generate exactly 3 to 4 high-leverage clarifying questions to scope the autonomous agent's workspace.

STRICT ANTI-HALLUCINATION & RELEVANCE RULES:
1. Stay strictly grounded in the user's domain. Never ask generic questions like "What color should buttons be?" or "Should the app be user friendly?".
2. Every option provided in the options array must be a concrete, real, currently supported technology (e.g. Next.js 15, Vite + React 19, FastAPI, Drizzle ORM, Prisma, PostgreSQL 16).
3. Probe exact runtime constraints, data contracts, and failure handling modes.

FOCUS DIMENSIONS:
1. Architectural Deployment & Runtime: Next.js 15 App Router vs Vite React 19 SPA vs FastAPI / Node REST.
2. Data Layer & Schema Contracts: PostgreSQL 16+ with Drizzle ORM vs Prisma ORM vs Supabase RLS vs Neon Serverless Postgres.
3. State & Edge Case Handling: Optimistic UI with rollback vs pessimistic transactional blocking vs CQRS event sourcing.
4. Testing & Verification: Vitest unit tests + Playwright E2E vs Jest.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments:
[
  {
    "id": "q1",
    "questionText": "What primary runtime environment...",
    "questionType": "single_select",
    "options": ["Option A", "Option B", "Option C"]
  }
]`,
    synthesisPrompt: CODING_AGENT_MASTER_PROMPT,
    zodOutputSchema: CodingAgentOutputSchema,
    fallbackQuestions: [
      {
        id: 'tech_stack',
        questionText: 'What exact runtime & framework constraints must the coding agent follow?',
        questionType: 'single_select',
        options: [
          'React 19 / TypeScript 5.5+ / Vite (Strict Mode)',
          'Next.js 15 App Router + Server Actions + Drizzle ORM',
          'Node.js / Express / TypeScript REST Backend',
          'Python / FastAPI / Pydantic AI Agents',
          'Mobile (React Native Expo + TypeScript)',
        ],
      },
      {
        id: 'schema_contracts',
        questionText: 'What database, ORM, or API validation schema should the agent implement?',
        questionType: 'single_select',
        options: [
          'PostgreSQL + Prisma ORM + Zod runtime schemas',
          'PostgreSQL + Drizzle ORM + Zod runtime schemas',
          'Supabase JS Client + Database Types + RLS',
          'In-memory SQLite + Zod Schema validation',
        ],
      },
      {
        id: 'negative_rules',
        questionText: 'What strict negative constraints must the AI agent NEVER break?',
        questionType: 'multi_select',
        options: [
          'NEVER use "any" types or loose assertions',
          'NEVER leave "// TODO" placeholder comments',
          'NEVER swallow errors without structured logging',
          'NEVER mutate state or props directly',
          'NEVER execute synchronous blocking operations',
        ],
      },
    ],
    fewShotExamples: [
      {
        title: 'Autonomous Web Scraper & Pipeline in TypeScript',
        inputIdea: 'Build an autonomous price scraper that crawls competitor e-commerce sites and alerts on price drops.',
        clarifyingQuestions: [
          {
            id: 'engine_type',
            questionText: 'Which scraping engine should the agent use?',
            questionType: 'single_select',
            options: ['Playwright Headless with stealth plugin', 'Cheerio + fetch HTTP parser'],
            sampleAnswer: 'Playwright Headless with stealth plugin',
          },
        ],
        synthesizedOutputSnippet: `# Competitor Price Intelligence Scraper - Agent Rulebook (.cursorrules)\n\n<role>\nYou are an autonomous Principal Backend Engineer specializing in high-resilience web extraction.\n</role>`,
      },
    ],
  },

  'image-prompt': {
    id: 'image-prompt',
    name: 'Image Prompt',
    tag: 'IMG',
    badgeColor: 'fuchsia',
    description: 'Expert visual prompt crafting for Midjourney v6.1, FLUX.1 [dev/pro], DALL-E 3, and Stable Diffusion XL with cinematography and optical parameters.',
    aliases: ['image_generation', 'image-generation', 'image-prompt', 'img', 'midjourney', 'flux'],
    temperature: 0.75,
    forbiddenTerms: [
      'code',
      'function',
      'class',
      'import',
      'npm',
      'database',
      'typescript',
      'react',
      'api',
      'backend',
      'frontend',
      'terminal',
      'bash',
      'curl',
      'git',
      'tsc --noEmit',
    ],
    questionPrompt: `You are Bedrock's Master AI Art Director and Hollywood Cinematographer.
Your task is to analyze the user's visual concept and generate exactly 3 to 4 high-leverage clarifying questions to craft the ultimate AI image prompt.

CRITICAL MANDATE (STRICT ZERO CODE):
- ABSOLUTELY ZERO CODE, ZERO PROGRAMMING LANGUAGES, ZERO DATABASES, ZERO APIS, AND ZERO SOFTWARE TECH STACKS.
- If you ask any question about coding, frameworks, databases, or terminal commands, it is an AUTOMATIC FAILURE.

FOCUS DIMENSIONS:
1. Artistic Medium & Photographic Aesthetic: Ultra-realistic 35mm film photography, 70mm IMAX cinema, Renaissance chiaroscuro oil painting, Unreal Engine 5 render, or anime watercolor.
2. Camera Optics & Lens Physics: 24mm wide-angle, 50mm f/1.2 normal prime, 85mm f/1.4 portrait prime, 135mm telephoto, aperture depth of field, and bokeh characteristics.
3. Lighting Setup & Environmental Atmosphere: Golden hour warm sunlight, moody neon noir with wet asphalt reflections, dramatic chiaroscuro studio lighting, volumetric god rays.
4. Color Grading & Film Stock Simulation: Kodak Portra 400, CineStill 800T, Fujifilm Velvia 50, Technicolor 3-strip.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: IMAGE_GENERATION_MASTER_PROMPT,
    zodOutputSchema: ImagePromptOutputSchema,
    fallbackQuestions: [
      {
        id: 'visual_style',
        questionText: 'What artistic medium, photographic aesthetic, or visual style do you want?',
        questionType: 'single_select',
        options: [
          'Ultra-Realistic 35mm Photography (85mm f/1.4 lens, film grain, 8K)',
          'Cinematic Concept Art & Sci-Fi / Dark Fantasy',
          'Stylized 3D Animation / Pixar & Unreal Engine 5 Render',
          'Anime & Manga / Studio Ghibli Aesthetic',
        ],
      },
      {
        id: 'lighting_atmosphere',
        questionText: 'What lighting setup, atmosphere, and environmental mood do you envision?',
        questionType: 'single_select',
        options: [
          'Golden Hour Sunlight with Warm Volumetric Dust Rays',
          'Moody Neon Noir Lighting with Wet Ground Reflections',
          'Dramatic Studio Chiaroscuro & Strong Rim Light',
          'Soft Ethereal Diffused Light with Morning Mist',
        ],
      },
    ],
    fewShotExamples: [
      {
        title: 'Cyberpunk Neo-Tokyo Street Ramen Stall at Midnight',
        inputIdea: 'A cozy midnight ramen stall in a rainy futuristic cyberpunk city alleyway with glowing neon signs.',
        clarifyingQuestions: [],
        synthesizedOutputSnippet: `# Midnight Cyberpunk Ramen Stall - Visual Art Direction Master System\n\n### Master Midjourney v6.1 Prompt\n\`\`\`text\nCinematic street photography of a cozy weathered wooden ramen stall in Neo-Tokyo alleyway, midnight rain, warm amber paper lanterns, wet reflective asphalt reflecting neon signs, 35mm CineStill 800T, Leica M11 --ar 16:9 --v 6.1 --style raw --stylize 250\n\`\`\``,
      },
    ],
  },

  'writing': {
    id: 'writing',
    name: 'Writing & Editorial',
    tag: 'TEXT',
    badgeColor: 'sky',
    description: 'Long-form thought leadership, technical essays, brand storytelling, marketing narratives, and editorial whitepapers with zero AI clichés or conversational fluff.',
    aliases: ['writing', 'editorial', 'copywriting', 'essay', 'article', 'text', 'content'],
    temperature: 0.7,
    forbiddenTerms: [
      'delve',
      'delving',
      'tapestry',
      'testament',
      'in conclusion',
      'it is important to remember',
      'it is worth noting',
      'furthermore',
      'moreover',
      'beacon',
      'unleash',
      'pinnacle',
      'bustling',
      'plethora',
      'navigating the landscape',
      'realm',
      'game-changer',
      'revolutionize',
    ],
    questionPrompt: `You are Bedrock's Chief Editorial Officer and Master Essayist.
Your task is to analyze the user's writing idea and generate exactly 3 to 4 high-leverage clarifying questions to craft a publication-grade Editorial & Long-Form Essay Blueprint.

STRICT ANTI-CLICHÉ & VOICE RULES:
1. Focus on thesis spine, contrarian hooks, empirical evidence, and target audience depth.
2. Strictly forbid superficial or conversational filler.

FOCUS DIMENSIONS:
1. Target Reader & Domain Familiarity: Senior Engineers & Technical Founders (deep rigor) vs Business Decision-Makers (strategic ROI) vs General Intellectuals (vivid narrative).
2. Editorial Voice & Prose Cadence: Sharp, contrarian and crisp (Paul Graham style) vs Immersive journalistic feature (New Yorker / Wired) vs Empirical academic whitepaper.
3. The Status Quo "Villain": The specific industry myth, cognitive bias, or legacy assumption being dismantled.
4. Empirical Evidence & Case Studies: Real historical precedents, engineering post-mortems, or economic data to ground the core thesis.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: WRITING_MASTER_PROMPT,
    zodOutputSchema: WritingOutputSchema,
    fallbackQuestions: [
      {
        id: 'audience_depth',
        questionText: 'Who is the primary audience and what is their existing technical/domain familiarity?',
        questionType: 'single_select',
        options: [
          'Senior Engineers & Technical Founders (deep nuance, zero hand-holding)',
          'Product & Business Decision-Makers (strategic leverage, ROI)',
          'Curious General Readers (accessible storytelling, vivid analogies)',
        ],
      },
      {
        id: 'editorial_voice',
        questionText: 'What editorial voice and prose style should this piece inhabit?',
        questionType: 'single_select',
        options: [
          'Sharp, contrarian, and crisp (Paul Graham / Naval Ravikant style)',
          'Immersive, narrative-driven, and journalistic (Wired / New Yorker feature)',
          'Rigorous, empirical, and analytical (Academic whitepaper / deep dive)',
        ],
      },
    ],
    fewShotExamples: [
      {
        title: 'The Death of Localhost & The Cloud Dev Shift',
        inputIdea: 'An essay arguing that running dev servers on local laptops is obsolete.',
        clarifyingQuestions: [],
        synthesizedOutputSnippet: `# The Death of Localhost - Editorial Blueprint & Narrative Outline\n\n### Core Thesis\nFor forty years, software development required replicating the entire server environment on personal silicon. Ephemeral micro-compute makes local configuration an expensive productivity tax.`,
      },
    ],
  },

  'freelance-brief': {
    id: 'freelance-brief',
    name: 'Freelance Brief',
    tag: 'BRIEF',
    badgeColor: 'purple',
    description: 'Executive scopes of work (SOW), Upwork contracts, fixed-fee proposals, milestone matrices, and client boundary playbooks to eliminate scope creep.',
    aliases: ['freelancer_brief', 'freelance-brief', 'freelance_sow', 'brief', 'contract', 'proposal'],
    temperature: 0.35,
    forbiddenTerms: [
      'unlimited revisions',
      'work for exposure',
      'asap without deadline',
      'tbd budget',
      'pay upon satisfaction',
      'equity only without salary',
      'various tasks as needed',
      'guaranteed 100% sales increase',
    ],
    questionPrompt: `You are Bedrock's Senior Agency Managing Director and Client Contract Negotiator.
Your task is to analyze the user's freelance project concept and generate exactly 3 to 4 high-leverage clarifying questions to construct an airtight Scope of Work (SOW).

STRICT ANTI-HALLUCINATION & RELEVANCE RULES:
1. Focus strictly on commercial deliverables, milestones, acceptance criteria, and scope boundaries.
2. Never ask vague or superficial questions.

FOCUS DIMENSIONS:
1. Core Deliverable Architecture: Fullstack production web application, pixel-perfect Figma implementation, or backend API & data architecture.
2. Milestone Delivery & Payment Phasing: 2-week sprint (50/50), 4-week phased milestones (30/40/30), or retainer with weekly caps.
3. Critical Out-of-Scope Firewalls: Third-party API fees, native mobile apps, ongoing copywriting, or legacy database migrations.
4. Client Review & Turnaround SLA: 48-hour client review turnaround, sign-off triggers, and post-launch bug warranty period.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: FREELANCER_BRIEF_MASTER_PROMPT,
    zodOutputSchema: FreelanceBriefOutputSchema,
    fallbackQuestions: [
      {
        id: 'deliverables',
        questionText: 'What is the primary deliverable for this freelance contract?',
        questionType: 'single_select',
        options: [
          'Production-Ready Fullstack Web Application',
          'Frontend UI / Pixel-Perfect Figma Implementation',
          'Scalable Backend API & Database Architecture',
        ],
      },
      {
        id: 'timeline_milestones',
        questionText: 'What is the target delivery timeline and payment structure?',
        questionType: 'single_select',
        options: [
          '2-Week Sprint (50% upfront, 50% on final staging delivery)',
          '4-Week Phased Milestones (30% deposit / 40% mid-point / 30% handoff)',
          'Hourly Retainer with weekly tracked time and billing caps',
        ],
      },
    ],
    fewShotExamples: [
      {
        title: 'Headless Next.js Storefront SOW',
        inputIdea: 'Shopify migration to Next.js 15 with headless store.',
        clarifyingQuestions: [],
        synthesizedOutputSnippet: `# Scope of Work (SOW): Headless Next.js 15 Storefront\n\n### Deliverables & Acceptance Criteria\n| Milestone | Deliverable | Criteria |\n|---|---|---|\n| M1 | Next.js 15 Foundation | Full catalog hydration |`,
      },
    ],
  },

  'pitch': {
    id: 'pitch',
    name: 'Pitch & Hackathon',
    tag: 'PITCH',
    badgeColor: 'amber',
    description: 'High-impact 2-minute demo day pitches, hackathon winning narratives, investor presentations, and judge evaluation rubric optimizations.',
    aliases: ['hackathon_pitch', 'pitch', 'hackathon_mvp', 'hackathon', 'demo_day', 'investor_deck'],
    temperature: 0.6,
    forbiddenTerms: [
      'uber for x without differentiation',
      'we have no competitors',
      'everyone in the world is our customer',
      'if we just capture 1% of china',
      'unrealistic TAM',
      'guaranteed 1000x returns',
    ],
    questionPrompt: `You are Bedrock's Chief Hackathon Judge and Demo Day Pitch Coach.
Your task is to analyze the user's hackathon idea and generate exactly 3 to 4 high-leverage clarifying questions to build a winning 2-minute demo day battle plan.

STRICT ANTI-HALLUCINATION & RELEVANCE RULES:
1. Enforce 24-hour scope reality: focus on the 90-second live demo "wow moment" and P0 happy path.
2. Never ask about complex 6-month enterprise features.

FOCUS DIMENSIONS:
1. Target Prize Track & Evaluation Focus: Grand Prize Overall Innovation, Best Autonomous AI Agent Architecture, or Best UI/UX Polish.
2. The 15-Second "Jaw-Drop" Demo Wow Moment: The single climactic live screen action that will shock judges and win the room.
3. Rapid Prototyping Stack & Shortcuts: Next.js 15 + Aceternity UI, Clerk/Supabase managed auth, Neon serverless Postgres, and pre-seeded mock datasets.
4. Stage Disaster Fallbacks: Localhost offline mock mode vs pre-recorded 1080p demo video.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: HACKATHON_PITCH_MASTER_PROMPT,
    zodOutputSchema: PitchOutputSchema,
    fallbackQuestions: [
      {
        id: 'hackathon_track',
        questionText: 'Which prize track or evaluation criteria is this hackathon pitch prioritizing?',
        questionType: 'single_select',
        options: [
          'Grand Prize / Overall Innovation & Wow Factor',
          'Best AI / Autonomous LLM Agent Architecture',
          'Best UI / UX Polish & Consumer Experience',
        ],
      },
      {
        id: 'demo_wow_moment',
        questionText: 'What is the 15-second "jaw-dropping" moment in your live demo that judges will remember?',
        questionType: 'free_text',
      },
    ],
    fewShotExamples: [
      {
        title: 'PulseGuard Offline AI Paramedic Voice Triage',
        inputIdea: 'Hands-free offline voice assistant for emergency paramedics.',
        clarifyingQuestions: [],
        synthesizedOutputSnippet: `# PulseGuard - 2-Minute Winning Demo Script\n\n*"In emergency medicine, the first 60 seconds decide survival—yet paramedics spend 30% of that time scribbling on rubber gloves with ballpoint pens."*`,
      },
    ],
  },

  'video-generation': {
    id: 'video-generation',
    name: 'Video Generation',
    tag: 'VIDEO',
    badgeColor: 'violet',
    description: 'Cinematic video prompting for Runway Gen-3 Alpha, OpenAI Sora, Luma Dream Machine, Kling AI, and Pika.',
    aliases: ['video_generation', 'video-generation', 'video', 'sora', 'runway'],
    temperature: 0.7,
    forbiddenTerms: ['code', 'function', 'class', 'import', 'npm', 'database', 'typescript', 'react'],
    questionPrompt: `You are Bedrock's Hollywood Virtual Production Director and Cinematic AI Video Specialist.
Your task is to analyze the user's video concept and generate exactly 3 to 4 high-leverage clarifying questions for Runway Gen-3, OpenAI Sora, and Luma Dream Machine.

CRITICAL MANDATE (STRICT ZERO CODE):
- ABSOLUTELY ZERO SOFTWARE CODE, ZERO PROGRAMMING SYNTAX, ZERO WEB DEV TERMINOLOGY.

FOCUS DIMENSIONS:
1. Camera Motion Trajectory & Choreography: Dynamic FPV drone sweeping fly-through, slow 360-degree orbital pan, smooth steadicam tracking push-in, or vertigo dolly zoom.
2. Temporal Dynamics & Pacing: 24fps cinema real-time, 60fps high-motion sports fluidity, or dramatic 120fps slow-motion deceleration.
3. Scene Physics & Environmental Elements: Fluid splashes, particle smoke/dust, rain streak reflections, or cloth dynamics.
4. Lighting Shifts & Atmospheric Mood: Dynamic headlight sweeps, day-to-night transitions, volumetric beacon rays.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: VIDEO_GENERATION_MASTER_PROMPT,
    zodOutputSchema: z.object({ questions: QuestionsArraySchema, synthesis: z.string().min(50) }),
    fallbackQuestions: [
      {
        id: 'camera_motion',
        questionText: 'What cinematic camera movement and framing should anchor the shot?',
        questionType: 'single_select',
        options: ['Dynamic FPV Drone Sweeping Fly-Through', 'Smooth Steadicam Tracking Shot', 'Cinematic Slow Orbital Pan (360°)'],
      },
    ],
    fewShotExamples: [],
  },

  'no-code': {
    id: 'no-code',
    name: 'No-Code & Visual App',
    tag: 'NOCODE',
    badgeColor: 'blue',
    description: 'Visual application architecture for Bubble.io, FlutterFlow, Webflow, Xano, Supabase, and Make automation pipelines.',
    aliases: ['no_code', 'no-code', 'nocode', 'bubble', 'flutterflow'],
    temperature: 0.4,
    forbiddenTerms: ['complex c++ pointers', 'raw assembly', 'manual memory allocation'],
    questionPrompt: `You are Bedrock's Principal No-Code Systems Architect and Workflow Automation Strategist.
Your task is to analyze the user's application idea and generate exactly 3 to 4 high-leverage clarifying questions to architect a robust No-Code blueprint.

STRICT ANTI-HALLUCINATION & RELEVANCE RULES:
1. Ground questions strictly in visual application platforms (Bubble, FlutterFlow, Webflow, Xano, Supabase, Make.com).
2. Never ask about raw assembly, C/C++, or low-level systems code.

FOCUS DIMENSIONS:
1. Visual Builder Platform: Bubble.io (Fullstack web app) vs FlutterFlow (Native iOS/Android) vs Webflow + Wized/Xano.
2. Relational Database Architecture: Built-in Bubble database vs external scalable PostgreSQL / Supabase with Row-Level Security.
3. Automation Orchestration & Webhooks: Multi-step Make.com / Zapier scenarios with error queues and retry handlers.
4. Security & API Protection: Backend API connector proxies to conceal private API keys from client bundles.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: NO_CODE_MASTER_PROMPT,
    zodOutputSchema: z.object({ questions: QuestionsArraySchema, synthesis: z.string().min(50) }),
    fallbackQuestions: [
      {
        id: 'platform',
        questionText: 'What is your primary visual builder platform?',
        questionType: 'single_select',
        options: ['Bubble.io (Fullstack Web App)', 'FlutterFlow (Native iOS & Android)', 'Webflow + Wized / Xano'],
      },
    ],
    fewShotExamples: [],
  },
};

// ----------------- Helper Functions -----------------

export function normalizeProfileId(input?: string): UseCaseProfileId {
  if (!input) return 'coding-agent';
  const cleaned = input.toLowerCase().trim().replace(/_/g, '-');

  for (const [key, profile] of Object.entries(USE_CASE_PROFILES) as [UseCaseProfileId, UseCaseProfile][]) {
    if (key === cleaned) return key;
    if (profile.aliases.some((a) => a.toLowerCase().replace(/_/g, '-') === cleaned)) {
      return key;
    }
  }

  if (cleaned.includes('code') || cleaned.includes('dev') || cleaned.includes('script') || cleaned.includes('fullstack')) {
    return 'coding-agent';
  }
  if (cleaned.includes('image') || cleaned.includes('photo') || cleaned.includes('picture') || cleaned.includes('midjourney') || cleaned.includes('flux')) {
    return 'image-prompt';
  }
  if (cleaned.includes('writing') || cleaned.includes('essay') || cleaned.includes('article') || cleaned.includes('blog') || cleaned.includes('editorial') || cleaned.includes('copy')) {
    return 'writing';
  }
  if (cleaned.includes('freelanc') || cleaned.includes('sow') || cleaned.includes('brief') || cleaned.includes('client') || cleaned.includes('contract')) {
    return 'freelance-brief';
  }
  if (cleaned.includes('pitch') || cleaned.includes('hackathon') || cleaned.includes('deck') || cleaned.includes('investor') || cleaned.includes('demo')) {
    return 'pitch';
  }
  if (cleaned.includes('video') || cleaned.includes('sora') || cleaned.includes('runway') || cleaned.includes('cinematic')) {
    return 'video-generation';
  }
  if (cleaned.includes('no-code') || cleaned.includes('nocode') || cleaned.includes('bubble') || cleaned.includes('flutterflow')) {
    return 'no-code';
  }

  return 'coding-agent';
}

export function getUseCaseProfile(idOrAlias?: string): UseCaseProfile {
  const normalizedId = normalizeProfileId(idOrAlias);
  return USE_CASE_PROFILES[normalizedId] || USE_CASE_PROFILES['coding-agent'];
}

// ----------------- Cheap Classifier -----------------

export interface ClassifierResult {
  detectedProfileId: UseCaseProfileId;
  confidence: number;
  isConfirmed: boolean;
  reasoning: string;
  matchedKeywords: string[];
}

const KEYWORD_DICTIONARY: Record<UseCaseProfileId, { strong: string[]; medium: string[] }> = {
  'coding-agent': {
    strong: [
      'typescript', 'next.js', 'react', 'fastapi', 'prisma', 'drizzle', 'sqlite', 'postgres',
      'docker', 'graphql', 'rest api', 'cursor', 'copilot', 'endpoint', 'frontend', 'backend',
      'fullstack', 'compiler', 'npm', 'pnpm', 'vitest', 'jest', 'tailwind', 'schema', 'orm'
    ],
    medium: ['code', 'build', 'app', 'function', 'class', 'test', 'deploy', 'system', 'api', 'model'],
  },
  'image-prompt': {
    strong: [
      'midjourney', 'flux', 'dall-e', 'stable diffusion', 'photorealistic', '35mm', 'octane render',
      'unreal engine', 'chiaroscuro', 'bokeh', 'cinematic lighting', 'aspect ratio', '--ar',
      'hyperrealistic', 'film grain', '8k resolution', 'cinestill', 'kodak portra'
    ],
    medium: ['image', 'photo', 'picture', 'render', 'illustration', 'portrait', 'lighting', 'visual', 'shot', 'camera'],
  },
  'writing': {
    strong: [
      'essay', 'blog post', 'article', 'whitepaper', 'newsletter', 'editorial', 'op-ed',
      'copywriting', 'storytelling', 'press release', 'speech', 'manifesto', 'case study'
    ],
    medium: ['write', 'draft', 'tone of voice', 'narrative', 'story', 'arguments', 'content', 'author', 'publish', 'chapter'],
  },
  'freelance-brief': {
    strong: [
      'scope of work', 'sow', 'upwork', 'freelance', 'contractor', 'hourly rate', 'milestone',
      'payment schedule', 'client deliverable', 'acceptance criteria', 'revisions', 'fixed price'
    ],
    medium: ['client', 'budget', 'timeline', 'quote', 'retainer', 'freelancer', 'handoff', 'proposal', 'agreement', 'scope'],
  },
  'pitch': {
    strong: [
      'pitch deck', 'hackathon', 'demo day', 'investor', 'venture capital', 'tam', 'sam', 'som',
      'elevator pitch', 'bounty', 'judging criteria', 'secret sauce', 'seed round'
    ],
    medium: ['pitch', 'judges', 'demo', 'prize', 'competition', 'slide', 'funding', 'deck', 'hook'],
  },
  'video-generation': {
    strong: ['runway', 'sora', 'luma', 'kling', 'pika', 'cinematography', 'frame rate', 'fps', 'camera pan', 'drone shot'],
    medium: ['video', 'animation', 'clip', 'motion'],
  },
  'no-code': {
    strong: ['bubble.io', 'bubble', 'flutterflow', 'webflow', 'make.com', 'zapier', 'airtable', 'xano'],
    medium: ['no-code', 'nocode', 'low-code', 'visual app'],
  },
};

export function classifyUseCase(
  ideaText: string,
  currentSelectedProfile?: string
): ClassifierResult {
  const currentProfileId = normalizeProfileId(currentSelectedProfile);
  const text = (ideaText || '').toLowerCase().trim();

  if (!text || text.length < 5) {
    return {
      detectedProfileId: currentProfileId,
      confidence: 0.5,
      isConfirmed: true,
      reasoning: 'Input text too short for high-confidence classification; using selected profile.',
      matchedKeywords: [],
    };
  }

  const scores: Record<UseCaseProfileId, { score: number; matches: string[] }> = {
    'coding-agent': { score: 0, matches: [] },
    'image-prompt': { score: 0, matches: [] },
    'writing': { score: 0, matches: [] },
    'freelance-brief': { score: 0, matches: [] },
    'pitch': { score: 0, matches: [] },
    'video-generation': { score: 0, matches: [] },
    'no-code': { score: 0, matches: [] },
  };

  for (const [profileKey, dict] of Object.entries(KEYWORD_DICTIONARY) as [UseCaseProfileId, { strong: string[]; medium: string[] }][]) {
    for (const kw of dict.strong) {
      if (text.includes(kw)) {
        scores[profileKey].score += 3.5;
        if (!scores[profileKey].matches.includes(kw)) {
          scores[profileKey].matches.push(kw);
        }
      }
    }
    for (const kw of dict.medium) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(text)) {
        scores[profileKey].score += 1.2;
        if (!scores[profileKey].matches.includes(kw)) {
          scores[profileKey].matches.push(kw);
        }
      }
    }
  }

  let bestProfileId: UseCaseProfileId = currentProfileId;
  let highestScore = 0;

  for (const [profileId, data] of Object.entries(scores) as [UseCaseProfileId, { score: number; matches: string[] }][]) {
    if (data.score > highestScore) {
      highestScore = data.score;
      bestProfileId = profileId;
    }
  }

  const currentScore = scores[currentProfileId].score;

  if (highestScore === 0) {
    return {
      detectedProfileId: currentProfileId,
      confidence: 0.5,
      isConfirmed: true,
      reasoning: 'No distinct domain keywords found; honoring user selection.',
      matchedKeywords: [],
    };
  }

  const confidence = Math.min(0.98, Math.max(0.4, Number((highestScore / (highestScore + 4)).toFixed(2))));
  const isConfirmed = bestProfileId === currentProfileId || (currentScore > 0 && highestScore - currentScore < 2.0);
  const matchedKeywords = scores[bestProfileId].matches;

  return {
    detectedProfileId: bestProfileId,
    confidence,
    isConfirmed,
    reasoning: isConfirmed
      ? `Confirmed ${USE_CASE_PROFILES[currentProfileId].name} based on indicators: ${scores[currentProfileId].matches.slice(0, 3).join(', ') || 'intent'}.`
      : `Detected strong signals for ${USE_CASE_PROFILES[bestProfileId].name} (${matchedKeywords.slice(0, 3).join(', ')}).`,
    matchedKeywords,
  };
}

export function validatePromptAgainstForbiddenTerms(
  content: string,
  profileOrId: UseCaseProfile | string
): { isValid: boolean; valid: boolean; violations: string[]; foundTerms: string[] } {
  const profile = typeof profileOrId === 'string' ? getUseCaseProfile(profileOrId) : profileOrId;
  const lower = (content || '').toLowerCase();
  const violations: string[] = [];

  for (const term of profile.forbiddenTerms) {
    if (lower.includes(term.toLowerCase())) {
      violations.push(term);
    }
  }

  return {
    isValid: violations.length === 0,
    valid: violations.length === 0,
    violations,
    foundTerms: violations,
  };
}
