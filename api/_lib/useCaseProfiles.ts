import { z } from 'zod';

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

FOCUS DIMENSIONS:
1. Exact Runtime & Framework Constraints: Next.js 15 App Router vs Vite SPA, TypeScript 5.5+ strict mode, Tailwind CSS v4.
2. Data Layer & Schema Contracts: PostgreSQL 16+, Prisma ORM vs Drizzle ORM, Zod runtime validation schemas, relationship cardinality.
3. Negative Anti-Patterns Matrix: What the autonomous agent must NEVER do (e.g. no 'any', no placeholder comments, no direct state mutation).
4. Automated Verification Harness: Runnable terminal commands (tsc --noEmit, vitest run, lint) required for definition of done.

Output MUST be strictly a JSON array of question objects without markdown backticks or comments.`,
    synthesisPrompt: `You are Bedrock, the frontier AI Prompt Architect for autonomous coding agents (Cursor, Windsurf, Claude Code, Copilot).
Synthesize the user's concept and answers into an elite Agent Rulebook (.cursorrules / AGENT.md).

MANDATORY STRUCTURAL BLUEPRINT:
1. Executive Role & Architectural Philosophy (Principal Software Architect persona).
2. Master Agent System Prompt enclosed in a copy-pasteable markdown code block with strict XML directives (<directives>, <file_topology>, <negative_constraints>, <schema_contracts>, <verification_protocol>).
3. File Tree Topology & Module Architecture.
4. Uncompromising Negative Constraints Matrix (Anti-Patterns).
5. Syntactically Valid Schema Contracts (TypeScript interfaces / Zod schemas).
6. Phased Implementation Sequence & Automated Verification Protocol.`,
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
    questionPrompt: `You are Bedrock's Master AI Art Director and Cinematographer.
Your task is to analyze the user's visual concept and generate exactly 3 to 4 high-leverage clarifying questions to craft the ultimate AI image prompt.

CRITICAL RULE (STRICT): ABSOLUTELY ZERO CODE, ZERO PROGRAMMING LANGUAGES, ZERO FRAMEWORKS, ZERO DATABASES, AND ZERO SOFTWARE TECH STACKS.

FOCUS DIMENSIONS:
1. Artistic Medium & Aesthetic Genre (35mm film, cinematic concept art, Unreal Engine 5 render, anime).
2. Lighting Setup, Mood & Atmosphere (Golden hour, volumetric rays, neon noir, chiaroscuro).
3. Camera Optics, Focal Length & Aspect Ratio (85mm lens, f/1.4, --ar 16:9, --ar 9:16).
4. Subjects, Textures & Exclusions.`,
    synthesisPrompt: `You are Bedrock, the premier AI Image Generation Prompt Master for Midjourney v6.1, FLUX.1, DALL-E 3, and SDXL.
Synthesize the user's concept and answers into an elite visual art direction master guide.

CRITICAL MANDATE: ABSOLUTELY ZERO PROGRAMMING CODE OR SOFTWARE TERMINOLOGY.

MANDATORY STRUCTURAL BLUEPRINT:
1. Visual Concept Summary & Art Direction.
2. Master Midjourney v6.1 Prompt (Ready to Copy-Paste with --ar, --v 6.1, --style raw, --stylize).
3. Master FLUX.1 / DALL-E 3 Natural Language Prompt.
4. Optical & Cinematography Specifications (Camera, lens, aperture, lighting setup).
5. Color Palette & Film Stock Profile (Kodak Portra, CineStill 800T).
6. Negative Prompt & Exclusion Matrix.`,
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
Analyze the user's writing idea and generate exactly 3 to 4 clarifying questions to calibrate voice, thesis, structure, and audience impact.`,
    synthesisPrompt: `You are Bedrock, the premier Literary Architect and Frontier Editorial Engine.
Synthesize the user's concept into an extraordinary, publication-ready Writing & Editorial Blueprint.
STRICT BAN ON ALL AI CLICHÉS: "delve", "tapestry", "testament", "in conclusion", "unleash", "furthermore", "beacon".`,
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
    questionPrompt: `You are Bedrock's Senior Agency Principal and Client Contract Negotiator.
Analyze the user's freelance project idea and generate exactly 3 to 4 clarifying questions to construct an airtight Scope of Work (SOW).`,
    synthesisPrompt: `You are Bedrock, the premier Client Agreement & Scope of Work (SOW) Architect.
Synthesize the user's concept into a professional, legally structured, milestone-driven Freelance Deliverable Brief.
Include: Executive Summary, Deliverables Matrix, Milestone Schedule, Out-of-Scope Firewalls, Revision Policy.`,
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
Generate 3 to 4 clarifying questions focusing on the Hook, the 2-minute live demo wow moment, prize track, and unfair advantage.`,
    synthesisPrompt: `You are Bedrock, the premier Venture Pitch & Hackathon Demo Day Mastermind.
Synthesize into a high-converting Pitch Blueprint: 10-Second Elevator Hook, Second-by-Second 2-Minute Demo Script, 10-Slide Deck Outline, and Judge Q&A Defense.`,
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
    questionPrompt: `Generate 3 to 4 clarifying questions focusing on camera motion, pacing, temporal physics, and scene lighting.`,
    synthesisPrompt: `Synthesize into a cinematic shot-by-shot blueprint with camera movements, speed ramping, and optical transitions.`,
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
    questionPrompt: `Generate 3 to 4 clarifying questions focusing on visual builder platform, database collections, and webhook automations.`,
    synthesisPrompt: `Synthesize an end-to-end No-Code Application Architecture with collection models, visual UI trees, and automation recipes.`,
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
