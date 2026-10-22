/**
 * Bedrock Use Case Profiles Architecture
 * Config objects per use case holding prompt templates, output schema requirements,
 * temperature tuning, forbidden terms matrices, and few-shot calibration examples.
 */

import { buildQuestionsSystemPrompt } from './aiPrompts';
import {
  CODING_AGENT_MASTER_PROMPT,
  IMAGE_GENERATION_MASTER_PROMPT,
  VIDEO_GENERATION_MASTER_PROMPT,
  FREELANCER_BRIEF_MASTER_PROMPT,
  HACKATHON_PITCH_MASTER_PROMPT,
  NO_CODE_MASTER_PROMPT,
  WRITING_MASTER_PROMPT,
} from './masterRolePrompts';

export type UseCaseProfileId =
  | 'coding_agent'
  | 'image_generation'
  | 'writing'
  | 'freelance_brief'
  | 'hackathon_pitch'
  | 'no_code'
  | 'video_generation';

export interface Question {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface ProfileFewShotExample {
  title: string;
  inputIdea: string;
  summary: string;
  excerpt: string;
  clarifyingQuestions?: Question[];
}

export interface UseCaseProfile {
  id: UseCaseProfileId;
  name: string;
  tag: string;
  description: string;
  temperature: number;
  minWordCount: number;
  forbiddenTerms: string[];
  requiredStructuralMarkers: string[];
  recommendedModels: string[];
  unreliableModels: string[];
  questionPrompt: string;
  synthesisPrompt?: string;
  fallbackQuestions: Question[];
  fewShotExamples: ProfileFewShotExample[];
}

export const USE_CASE_PROFILES: Record<UseCaseProfileId, UseCaseProfile> = {
  coding_agent: {
    id: 'coding_agent',
    name: 'Coding Agent',
    tag: 'DEV',
    description: 'Autonomous AI coding agent directives, rulebooks (.cursorrules / AGENT.md), and system specs',
    temperature: 0.2,
    minWordCount: 400,
    synthesisPrompt: CODING_AGENT_MASTER_PROMPT,
    forbiddenTerms: [
      '// TODO',
      '/* TODO',
      '/* implement',
      '// implement',
      '// add logic',
      'type any',
      ': any',
      'as any',
      'getStaticProps',
      'getServerSideProps',
      'componentWillMount',
      'React.createClass',
      'var ',
      'Certainly!',
      'Sure, here is',
      'I hope this helps',
      'As an AI model',
    ],
    requiredStructuralMarkers: [
      '# ',
      '<role>',
      '<directives>',
      '<negative_constraints>',
      '<schema_contracts>',
      '<verification_protocol>',
    ],
    recommendedModels: [
      'gemini-3.8-flash',
      'claude-3-5-sonnet',
      'deepseek-r1-distill-llama-70b',
      'gpt-4o-mini',
    ],
    unreliableModels: ['hf/zephyr-7b-beta', 'hf/Meta-Llama-3-8B-Instruct'],
    questionPrompt: buildQuestionsSystemPrompt('coding_agent'),
    fallbackQuestions: [
      {
        id: 'arch_target',
        questionText: 'What is your primary architectural deployment target and runtime environment?',
        questionType: 'single_select',
        options: ['Next.js 15 App Router & Server Actions', 'Vite React 19 SPA + Cloudflare Workers', 'Node.js Express / Fastify Microservice', 'Desktop App (Tauri / Electron)'],
      },
      {
        id: 'data_layer',
        questionText: 'Which persistence layer and database paradigm do you prefer?',
        questionType: 'single_select',
        options: ['PostgreSQL with Prisma / Drizzle ORM', 'Supabase with Row-Level Security', 'Redis + In-Memory State Store', 'Serverless Lakebase Postgres (Neon)'],
      },
      {
        id: 'state_handling',
        questionText: 'How should edge cases and optimistic state mutations be handled?',
        questionType: 'single_select',
        options: ['Optimistic UI with automatic rollback on failure', 'Strict pessimistic transactional blocking', 'Event-driven CQRS with event log'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Real-Time Markdown CRDT Editor',
        inputIdea: 'A real-time collaborative markdown editor with CRDT and WebSockets',
        summary: 'Full-stack collaborative editor with Yjs CRDT synchronization and Next.js 15 App Router',
        excerpt:
          '# Collaborative Markdown CRDT Architecture\n<role>\nPrincipal Systems Architect for Real-Time Collaborative Runtimes.\n</role>\n<directives>\n- Implement state reconciliation via Yjs Y.Doc and WebSocket provider.\n- Maintain offline buffer with IndexedDB sync.\n</directives>\n<negative_constraints>\n- NEVER use optimistic locks on client text buffers.\n- NEVER use `any` type.\n</negative_constraints>\n<schema_contracts>\nexport interface DocSession {\n  id: string;\n  version: number;\n}\n</schema_contracts>\n<verification_protocol>\n`npm run test` exits 0.\n</verification_protocol>',
        clarifyingQuestions: [
          {
            id: 'crdt_impl',
            questionText: 'Which CRDT synchronization protocol do you prefer?',
            questionType: 'single_select',
            options: ['Yjs with WebSocket Provider', 'Automerge with LocalFirst sync', 'Custom operational transformation'],
          },
        ],
      },
      {
        title: 'PostgreSQL Idempotent Webhook Processor',
        inputIdea: 'High-throughput payment gateway webhook processor with idempotency in PostgreSQL',
        summary: 'Zero-loss payment webhook ingestion pipeline with advisory locks and exponential backoff',
        excerpt:
          '# Idempotent Webhook Ingestion Engine\n<role>\nPrincipal Backend & Financial Ledger Engineer.\n</role>\n<directives>\n- Ingest incoming webhook payload with SHA-256 idempotency key deduplication.\n- Enforce transactional row-level lock.\n</directives>\n<negative_constraints>\n- NEVER process payments outside atomic SQL transactions.\n- NEVER log raw PAN or sensitive cardholder data.\n</negative_constraints>\n<schema_contracts>\nexport interface WebhookEvent {\n  idempotencyKey: string;\n  status: "processed" | "failed";\n}\n</schema_contracts>\n<verification_protocol>\n`vitest run --coverage` passes 100% suites.\n</verification_protocol>',
        clarifyingQuestions: [
          {
            id: 'concurrency',
            questionText: 'What peak webhook concurrency throughput must be supported?',
            questionType: 'single_select',
            options: ['100 req/sec (Single worker)', '1,000+ req/sec (Distributed queue with advisory locks)', '10,000+ req/sec (Kafka/Pulsar streaming)'],
          },
        ],
      },
    ],
  },

  image_generation: {
    id: 'image_generation',
    name: 'Image Generation',
    tag: 'IMG',
    description: 'Master image prompts for Midjourney v6.1, FLUX.1, DALL-E 3, and Stable Diffusion',
    temperature: 0.7,
    minWordCount: 250,
    synthesisPrompt: IMAGE_GENERATION_MASTER_PROMPT,
    forbiddenTerms: [
      '```typescript',
      '```javascript',
      '```tsx',
      'npm run',
      'const ',
      'function ',
      'import React',
      'Sure, here is your prompt',
      'Certainly!',
      'Here are some images',
    ],
    requiredStructuralMarkers: [
      '# ',
      'Midjourney',
      '--ar ',
      'FLUX',
      'Lighting',
      'Camera',
      'Color Palette',
    ],
    recommendedModels: [
      'gemini-3.8-flash',
      'gpt-4o-mini',
      'llama-3.3-70b-versatile',
      'claude-3-5-sonnet',
    ],
    unreliableModels: ['hf/zephyr-7b-beta'],
    questionPrompt: buildQuestionsSystemPrompt('image_generation'),
    fallbackQuestions: [
      {
        id: 'art_style',
        questionText: 'What primary visual aesthetic and artistic medium do you want?',
        questionType: 'single_select',
        options: ['Cinematic Photorealism (35mm / 70mm Film)', 'Stylized 3D Octane Render', 'Dark Fantasy Digital Painting', 'Minimalist Flat Vector Illustration'],
      },
      {
        id: 'lighting_env',
        questionText: 'What lighting setup and atmospheric conditions should dominate?',
        questionType: 'single_select',
        options: ['Moody neon reflections & wet chiaroscuro', 'Warm golden hour natural daylight', 'Volumetric studio strobe softbox', 'Bioluminescent glow in ink-black shadows'],
      },
      {
        id: 'aspect_ratio',
        questionText: 'What target aspect ratio should the primary prompt specify?',
        questionType: 'single_select',
        options: ['16:9 (Cinematic Widescreen)', '9:16 (Vertical Mobile Story)', '1:1 (Square Album / Post)', '4:5 (Portrait Editorial)'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Midnight Cyberpunk Tokyo Alley',
        inputIdea: 'Cyberpunk neon street market in Tokyo during rain at midnight with reflections',
        summary: 'Photorealistic cyberpunk alleyway with optical cinema lens details and Midjourney parameters',
        excerpt:
          '# Cyberpunk Tokyo Alleyway - Visual Master Directive\n\n### Master Midjourney v6.1 Prompt\n`/imagine prompt: cinematic 35mm photograph of a narrow rain-slicked neon alleyway in Shinjuku Tokyo at 2 AM, glowing holographic street signage reflecting in puddles, steam rising from ramen stall vents, 8k resolution, Kodak CineStill 800T, photorealistic volumetric lighting --ar 16:9 --style raw --v 6.1`\n\n### Master FLUX.1 / DALL-E 3 Prompt\nA detailed cinematic wide shot of a futuristic Tokyo alleyway drenched in midnight rain...',
        clarifyingQuestions: [
          {
            id: 'film_stock',
            questionText: 'Which film stock emulation should be prioritized?',
            questionType: 'single_select',
            options: ['Kodak CineStill 800T (Halation glow)', 'Fujifilm Superia (Green tones)', 'Kodak Portra 400 (Warm skin tones)'],
          },
        ],
      },
    ],
  },

  writing: {
    id: 'writing',
    name: 'Technical & Long-Form Writing',
    tag: 'DOCS',
    description: 'In-depth engineering essays, launch announcements, whitepapers, and technical post-mortems',
    temperature: 0.5,
    minWordCount: 450,
    synthesisPrompt: WRITING_MASTER_PROMPT,
    forbiddenTerms: [
      'In conclusion,',
      'It goes without saying',
      'Needless to say',
      'In this fast-paced world',
      'Delve into',
      'Tapestry',
      'Certainly!',
      'Sure, here is the article',
    ],
    requiredStructuralMarkers: [
      '# ',
      '## The Core Problem',
      '## Architecture & Mechanics',
      '## Trade-offs',
      '## Key Takeaways',
    ],
    recommendedModels: [
      'gemini-3.8-flash',
      'claude-3-5-sonnet',
      'gpt-4o-mini',
      'llama-3.3-70b-versatile',
    ],
    unreliableModels: ['hf/zephyr-7b-beta'],
    questionPrompt: buildQuestionsSystemPrompt('writing'),
    fallbackQuestions: [
      {
        id: 'target_audience',
        questionText: 'Who is the primary intended readership for this technical document?',
        questionType: 'single_select',
        options: ['Staff / Principal Software Engineers', 'CTO & Engineering Leadership', 'Open-Source Developer Community', 'Product Managers & Founders'],
      },
      {
        id: 'narrative_tone',
        questionText: 'What tone and depth should the writing strike?',
        questionType: 'single_select',
        options: ['Rigorous architectural teardown with benchmarks', 'Crisp product launch announcement', 'Opinionated engineering manifesto', 'Blameless incident post-mortem'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Why Edge Distributed Consensus Fails',
        inputIdea: 'In-depth engineering essay on why distributed consensus protocols fail in edge computing',
        summary: 'Rigorous architectural analysis of FLP impossibility, asymmetric partitions, and edge latency',
        excerpt:
          '# The Edge Partition Fallacy: Why Distributed Consensus Breaks at the Perimeter\n\n## The Core Problem\nConsensus algorithms like Raft and Paxos assume bounded latency and reliable quorum elections...',
        clarifyingQuestions: [],
      },
    ],
  },

  freelance_brief: {
    id: 'freelance_brief',
    name: 'Freelancer SOW & Brief',
    tag: 'BRIEF',
    description: 'Executive Scope of Work (SOW), milestone delivery tables, acceptance criteria, and contracts',
    temperature: 0.3,
    minWordCount: 350,
    synthesisPrompt: FREELANCER_BRIEF_MASTER_PROMPT,
    forbiddenTerms: [
      'etc.',
      'and so on',
      'TBD',
      'whenever possible',
      'Sure, here is your brief',
      'Certainly!',
    ],
    requiredStructuralMarkers: [
      '# ',
      '## Project Scope & Objectives',
      '## Deliverables Table',
      '## Acceptance Criteria',
      '## Milestones & Timeline',
      '## Out-of-Scope Boundaries',
    ],
    recommendedModels: [
      'gemini-3.8-flash',
      'llama-3.3-70b-versatile',
      'gpt-4o-mini',
      'claude-3-5-sonnet',
    ],
    unreliableModels: ['hf/zephyr-7b-beta'],
    questionPrompt: buildQuestionsSystemPrompt('freelance_brief'),
    fallbackQuestions: [
      {
        id: 'budget_timeline',
        questionText: 'What is the target project timeline and delivery horizon?',
        questionType: 'single_select',
        options: ['Rapid 2-week MVP sprint', '4-to-6 week phased delivery', 'Multi-month retainer with bi-weekly milestones'],
      },
      {
        id: 'deliverables_type',
        questionText: 'What is the primary deliverable expected by the client?',
        questionType: 'single_select',
        options: ['Full-stack working production application', 'Figma design system with UI component library', 'Backend API & cloud infrastructure setup', 'Security & performance remediation audit'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Headless Shopify Coffee Store',
        inputIdea: 'Complete redesign and Shopify Plus headless store build for an artisanal coffee roaster',
        summary: 'Executive Scope of Work with milestone deliverables, Sanity CMS integration, and acceptance criteria',
        excerpt:
          '# Scope of Work: Headless Shopify Plus Redesign\n\n## Project Scope & Objectives\nArchitect a high-performance headless commerce frontend using Next.js 15, Shopify Storefront API, and Sanity CMS...\n\n## Deliverables Table\n| Milestone | Deliverable | Acceptance Criteria | Timeline |\n| P1 | Architecture RFC | Approved schema | Week 1 |',
        clarifyingQuestions: [],
      },
    ],
  },

  hackathon_pitch: {
    id: 'hackathon_pitch',
    name: 'Hackathon Pitch & Sprint',
    tag: 'PITCH',
    description: '2-minute demo flow scripts, judging rubric optimization, P0/P1 scope, and 24-hr sprint plans',
    temperature: 0.6,
    minWordCount: 350,
    synthesisPrompt: HACKATHON_PITCH_MASTER_PROMPT,
    forbiddenTerms: [
      'In our long term roadmap',
      '5 year projection',
      'Eventually we will add',
      'Sure, here is your pitch',
      'Certainly!',
    ],
    requiredStructuralMarkers: [
      '# ',
      '## 10-Second Hook',
      '## The 2-Minute Demo Script',
      '## P0 MVP Happy Path',
      '## Judging Rubric Optimization',
      '## Tech Stack & Sponsor Bounties',
    ],
    recommendedModels: [
      'llama-3.3-70b-versatile',
      'gemini-3.8-flash',
      'gpt-4o-mini',
      'deepseek-r1-distill-llama-70b',
    ],
    unreliableModels: ['hf/zephyr-7b-beta'],
    questionPrompt: buildQuestionsSystemPrompt('hackathon_pitch'),
    fallbackQuestions: [
      {
        id: 'hackathon_track',
        questionText: 'Which prize track or evaluation criteria is this hackathon pitch prioritizing?',
        questionType: 'single_select',
        options: ['Grand Prize / Overall Innovation', 'Best AI / LLM Implementation', 'Best UI / UX Experience', 'Enterprise / B2B Utility', 'Open Source Impact'],
      },
      {
        id: 'demo_flow',
        questionText: 'What is the single most compelling live stage demo moment?',
        questionType: 'single_select',
        options: ['Instant live processing with audible/visual output in seconds', 'Hardware camera / sensor interaction', 'Multi-user real-time collaborative sync'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Real-Time Sign Language Translator',
        inputIdea: 'AI-powered real-time sign language translator using mobile camera and lightweight neural net',
        summary: 'Fast-paced 2-minute stage pitch and live demo script optimized for Accessibility and AI prize tracks',
        excerpt:
          '# SignFlow: Real-Time Mobile Sign Language Translation\n\n## 10-Second Hook\n"Over 70 million deaf individuals worldwide face daily communication barriers. SignFlow translates ASL to spoken audio in 120 milliseconds on any mobile browser—zero cloud latency."\n\n## The 2-Minute Demo Script\n[00:00 - 00:30] Live stage demo: Speaker signs into phone camera, speaker hears English synthesis in real time...',
        clarifyingQuestions: [],
      },
    ],
  },

  no_code: {
    id: 'no_code',
    name: 'No-Code Application',
    tag: 'NOCODE',
    description: 'Visual database schemas, Airtable/Bubble relations, and step-by-step Zapier/Make recipes',
    temperature: 0.3,
    minWordCount: 300,
    synthesisPrompt: NO_CODE_MASTER_PROMPT,
    forbiddenTerms: [
      'npm install',
      'cargo build',
      'docker-compose',
      'pointers',
      'memory allocation',
      'Sure, here is your app',
      'Certainly!',
    ],
    requiredStructuralMarkers: [
      '# ',
      '## Platform Selection & Architecture',
      '## Data Collections & Schema',
      '## Visual UI Screen Topology',
      '## Automation & Webhook Recipes',
      '## Security & Access Control',
    ],
    recommendedModels: [
      'gemini-3.8-flash',
      'llama-3.3-70b-versatile',
      'gpt-4o-mini',
    ],
    unreliableModels: ['hf/zephyr-7b-beta'],
    questionPrompt: buildQuestionsSystemPrompt('no_code'),
    fallbackQuestions: [
      {
        id: 'nocode_stack',
        questionText: 'Which no-code app builder ecosystem will be the primary host?',
        questionType: 'single_select',
        options: ['Airtable + Make.com / Zapier', 'Bubble (Full web app with internal DB)', 'Webflow + Memberstack + Stripe', 'Glide / Softr (Mobile & portal wrapper)'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Airtable Lead Qualification Pipeline',
        inputIdea: 'Automated lead intake and qualification system using Airtable, Make, and WhatsApp notifications',
        summary: 'Step-by-step visual automation pipeline with webhook payloads and Airtable relational schema',
        excerpt:
          '# Automated Lead Qualification & Dispatch System\n\n## Platform Selection & Architecture\n- Core Database: Airtable\n- Automation Engine: Make.com\n- Messaging Channel: Twilio WhatsApp Business API\n\n## Data Collections & Schema\nTable: `Leads` (ID, Company, Headcount, Score, Status)...',
        clarifyingQuestions: [],
      },
    ],
  },

  video_generation: {
    id: 'video_generation',
    name: 'Cinematic AI Video',
    tag: 'VIDEO',
    description: 'Runway Gen-3, Sora, and Luma prompt blocks with shot choreography and timeline storyboards',
    temperature: 0.7,
    minWordCount: 300,
    synthesisPrompt: VIDEO_GENERATION_MASTER_PROMPT,
    forbiddenTerms: [
      '```typescript',
      'npm run',
      'PostgreSQL',
      'React component',
      'Sure, here is your video',
      'Certainly!',
    ],
    requiredStructuralMarkers: [
      '# ',
      'Runway Gen-3',
      'Camera Movement',
      'Lighting',
      'Timeline Storyboard',
    ],
    recommendedModels: [
      'gemini-3.8-flash',
      'gpt-4o-mini',
      'llama-3.3-70b-versatile',
    ],
    unreliableModels: ['hf/zephyr-7b-beta'],
    questionPrompt: buildQuestionsSystemPrompt('video_generation'),
    fallbackQuestions: [
      {
        id: 'video_tool',
        questionText: 'Which AI video generator model is the primary generation target?',
        questionType: 'single_select',
        options: ['Runway Gen-3 Alpha', 'OpenAI Sora', 'Luma Dream Machine', 'Kling AI / Hailuo Minimax'],
      },
      {
        id: 'camera_choreography',
        questionText: 'What camera movement vector and shot choreography do you want?',
        questionType: 'single_select',
        options: ['Cinematic slow forward push-in with lens rack focus', 'Continuous dynamic orbital 360-degree Steadicam', 'High-altitude FPV drone swoop hugging terrain', 'Static locked-off telephoto with shallow depth of field'],
      },
    ],
    fewShotExamples: [
      {
        title: 'Deep Sea Bioluminescence Submersible',
        inputIdea: 'Deep sea exploration submersible discovering ancient bioluminescent ruins at ocean floor',
        summary: 'Cinematic Runway Gen-3 prompt block with fluid camera movement, particle dynamics, and lighting',
        excerpt:
          '# Abyssal Leviathan: Cinematic AI Video Blueprint\n\n### Master Runway Gen-3 Prompt Block\n`[Cinematic slow dolly-in, 4k ultra-detailed]: A glowing research submersible slowly descends through ink-black deep ocean waters. Dual tungsten halogen headlights illuminate ancient carved obsidian pillars covered in pulsing cyan bioluminescent sea anemones...`\n\n### Timeline Storyboard\n| Time | Shot Type | Camera Vector | Lighting | Action |',
        clarifyingQuestions: [],
      },
    ],
  },
};

export function getProfileById(id: string): UseCaseProfile {
  return USE_CASE_PROFILES[id as UseCaseProfileId] || USE_CASE_PROFILES.coding_agent;
}

export function getUseCaseProfile(id: string): UseCaseProfile {
  return getProfileById(id);
}

export function getAllProfiles(): UseCaseProfile[] {
  return Object.values(USE_CASE_PROFILES);
}

/**
 * Lightweight heuristic classifier that maps user text to the most relevant profile
 */
export function classifyUseCase(ideaText: string, currentTarget?: string): {
  profileId: UseCaseProfileId;
  detectedProfileId: UseCaseProfileId;
  suggestedProfile: UseCaseProfile | null;
  isConfirmed: boolean;
  confidence: number;
  matchedKeywords: string[];
  label: string;
} {
  const text = (ideaText || '').toLowerCase();

  const rules: { id: UseCaseProfileId; keywords: string[] }[] = [
    {
      id: 'video_generation',
      keywords: ['video', 'cinematic', 'camera movement', 'runway', 'sora', 'luma', 'dolly', 'fps', 'timelapse'],
    },
    {
      id: 'image_generation',
      keywords: ['image', 'photo', 'midjourney', 'flux', 'dall-e', 'portrait', 'illustration', 'wallpaper', '35mm', 'hasselblad'],
    },
    {
      id: 'hackathon_pitch',
      keywords: ['hackathon', 'pitch', 'demo', 'judges', 'sprint', 'presentation', 'investor', 'deck', 'hook'],
    },
    {
      id: 'freelance_brief',
      keywords: ['freelance', 'brief', 'sow', 'scope of work', 'client', 'milestones', 'deliverables', 'contract', 'hourly'],
    },
    {
      id: 'no_code',
      keywords: ['no-code', 'nocode', 'airtable', 'make.com', 'zapier', 'bubble', 'softr', 'glide', 'webflow'],
    },
    {
      id: 'writing',
      keywords: ['essay', 'article', 'writing', 'blog', 'post-mortem', 'whitepaper', 'editorial', 'newsletter', 'manifesto'],
    },
    {
      id: 'coding_agent',
      keywords: ['code', 'react', 'next.js', 'typescript', 'api', 'database', 'backend', 'full-stack', 'cursor', 'agent', 'auth', 'postgres'],
    },
  ];

  let bestMatch: UseCaseProfileId = 'coding_agent';
  let bestScore = 0;
  let bestMatchedKeywords: string[] = [];

  for (const rule of rules) {
    const matched = rule.keywords.filter((kw) => text.includes(kw));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      bestMatch = rule.id;
      bestMatchedKeywords = matched;
    }
  }

  const confidence = Math.min(1, Math.max(0.4, bestScore * 0.25));
  const normalizedCurrent = String(currentTarget || '').replace(/[-_]/g, '').toLowerCase();
  const normalizedDetected = String(bestMatch).replace(/[-_]/g, '').toLowerCase();
  const isConfirmed = Boolean(currentTarget && (normalizedCurrent === normalizedDetected || normalizedCurrent.includes(normalizedDetected) || normalizedDetected.includes(normalizedCurrent)));

  return {
    profileId: bestMatch,
    detectedProfileId: bestMatch,
    suggestedProfile: isConfirmed ? null : USE_CASE_PROFILES[bestMatch],
    isConfirmed,
    confidence,
    matchedKeywords: bestMatchedKeywords,
    label: USE_CASE_PROFILES[bestMatch].name,
  };
}

/**
 * Validates output text against forbidden terms for a given profile
 */
export function validatePromptAgainstForbiddenTerms(
  text: string,
  profileOrId: UseCaseProfile | UseCaseProfileId | string
): {
  valid: boolean;
  isValid: boolean;
  violations: string[];
  count: number;
} {
  const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId.id;
  const profile = getProfileById(profileId);
  const violations: string[] = [];

  for (const term of profile.forbiddenTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      violations.push(term);
    }
  }

  const isValid = violations.length === 0;
  return {
    valid: isValid,
    isValid,
    violations,
    count: violations.length,
  };
}
