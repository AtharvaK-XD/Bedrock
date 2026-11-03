
import { roleKey } from './useCaseProfiles.js';

export interface Question {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface ValidationIssue {
  type: 'schema' | 'forbidden_term' | 'fluff' | 'wrapper_leak' | 'length';
  message: string;
  term?: string;
  section?: string;
}

export interface ValidationResult<T = string> {
  isValid: boolean;
  issues: ValidationIssue[];
  forbiddenTermsFound: string[];
  missingSections: string[];
  repairedText?: string;
  data?: T;
}

const QUESTION_KINDS = ['single_select', 'multi_select', 'free_text'] as const;
const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 6;
const MIN_QUESTION_TEXT_CHARS = 8;

/**
 * Checks the shape of a parsed list of clarifying questions: 2 to 6 items, each with an id, question text of at
 * least 8 characters, one of the three question types, and (optionally) a list of non-empty option strings.
 * Plain checks instead of a schema library: this file is loaded by every AI route, and zod alone was about half
 * of the largest routes' size.
 */
export function checkQuestionShape(parsed: unknown): { ok: true; data: Question[] } | { ok: false; issues: Array<{ path: string; message: string }> } {
  const issues: Array<{ path: string; message: string }> = [];
  if (!Array.isArray(parsed)) {
    return { ok: false, issues: [{ path: '', message: 'Expected an array of questions' }] };
  }
  if (parsed.length < MIN_QUESTIONS) issues.push({ path: '', message: `Must generate at least ${MIN_QUESTIONS} clarifying questions` });
  if (parsed.length > MAX_QUESTIONS) issues.push({ path: '', message: `Must generate at most ${MAX_QUESTIONS} clarifying questions` });

  parsed.forEach((item, i) => {
    const at = (field: string) => `${i}.${field}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push({ path: String(i), message: 'Expected a question object' });
      return;
    }
    const q = item as Record<string, unknown>;
    if (typeof q.id !== 'string' || q.id.length < 1) issues.push({ path: at('id'), message: 'Question ID must not be empty' });
    if (typeof q.questionText !== 'string' || q.questionText.length < MIN_QUESTION_TEXT_CHARS) {
      issues.push({ path: at('questionText'), message: `Question text must be at least ${MIN_QUESTION_TEXT_CHARS} characters long` });
    }
    if (!(QUESTION_KINDS as readonly unknown[]).includes(q.questionType)) {
      issues.push({ path: at('questionType'), message: `Invalid option: expected one of ${QUESTION_KINDS.map((k) => `"${k}"`).join('|')}` });
    }
    if (q.options !== undefined) {
      if (!Array.isArray(q.options)) issues.push({ path: at('options'), message: 'Expected an array of options' });
      else q.options.forEach((o, j) => {
        if (typeof o !== 'string' || o.length < 1) issues.push({ path: `${at('options')}.${j}`, message: 'Option must be a non-empty string' });
      });
    }
  });

  return issues.length === 0 ? { ok: true, data: parsed as Question[] } : { ok: false, issues };
}

/**
 * Why a set of questions (already repaired by normalizeQuestions) should not be shown to the user, or an empty list
 * when they are fine: wrong shape (2 to 6 questions with real text), coding terms in an image or video profile
 * (the profiles forbid them), or chatty filler. Messages never repeat the user's text.
 * detectForbiddenTerms only knows the spellings image_generation / video_generation, hence the mapping.
 */
export function checkQuestionQuality(questions: unknown, profileId: string, userIdea?: string): string[] {
  const shape = checkQuestionShape(questions);
  if (!shape.ok) return shape.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message));

  const { forbiddenTerms, fluffTerms } = detectForbiddenTerms(JSON.stringify(shape.data), profileId, userIdea);
  return [
    ...forbiddenTerms.map((t) => `contains the coding term "${t}", which the ${profileId} profile forbids`),
    ...fluffTerms.map((t) => `contains conversational filler "${t}"`),
  ];
}

export const CONVERSATIONAL_FLUFF_PHRASES = [
  'sure, here is',
  'sure! here is',
  'certainly! here is',
  'certainly, here is',
  'here is your generated prompt',
  'here is the generated prompt',
  'here is your prompt',
  'i hope this helps',
  'hope this helps',
  'feel free to ask',
  'feel free to tweak',
  'as an ai language model',
  'as a large language model',
  'here\'s what i came up with',
  'happy prompting',
  'let me know if you need',
];

export const LAZY_STUB_PHRASES = [
  '// todo: implement',
  '// todo implement',
  '/* add logic here */',
  '// implement later',
  '[insert code here]',
  'TODO: Fill in',
  'add your code here',
  '// your code here',
];

// Library names that are also ordinary words ("angular shadows", "light drizzle", "vue sur la mer", "a svelte
// figure", "she turns to react", Spanish/Italian "prisma") are listed only in their unambiguous code forms: as bare
// words they flagged valid image and video prompts and forced a needless repair (prompt-quality eval, 2026-11-03).
export const MEDIA_FORBIDDEN_CODING_TERMS = [
  'react component',
  'react version',
  'react app',
  'react hooks',
  'react native',
  'react 18',
  'react 19',
  'react.js',
  'reactjs',
  'typescript',
  'javascript',
  'next.js',
  'nextjs',
  'vue.js',
  'vuejs',
  'vue 3',
  'vue app',
  'vue component',
  '@angular',
  'angularjs',
  'angular cli',
  'angular app',
  'angular component',
  'sveltekit',
  'svelte app',
  'svelte component',
  'npm',
  'npm install',
  'npm packages',
  'npx',
  'yarn add',
  'pnpm add',
  'pip install',
  'import react',
  'usestate',
  'useeffect',
  'usecallback',
  'usememo',
  'interface props',
  'type props',
  'postgresql',
  'prisma orm',
  'prisma client',
  'prisma schema',
  'prisma migrate',
  'drizzle orm',
  'drizzle-orm',
  'drizzle kit',
  'mongodb',
  'mysql',
  'sqlite',
  'docker',
  'kubernetes',
  'rest api',
  'graphql',
  'fastapi',
  'express.js',
  'tsc --noemit',
  'vitest',
  'curl -f',
  'node.js',
  'nodejs',
  'package.json',
  'tsconfig.json',
  'tailwind.config',
  'npm run dev',
  'npm run build',
  'npm test',
];

export interface BlueprintSectionRequirement {
  name: string;
  patterns: RegExp[];
  description: string;
}

export const TARGET_BLUEPRINT_SECTIONS: Record<string, BlueprintSectionRequirement[]> = {
  // The five parts WRITING_MASTER_PROMPT asks for. Without this entry, writing was checked against the coding
  // sections, and a "repair" then asked the model to add coding sections to an essay.
  writing: [
    {
      name: 'Working Titles & Lead Hooks',
      patterns: [/working\s+titles?/i, /lead\s+hooks?/i, /opening\s+(?:angles?|hooks?)/i, /headline/i],
      description: 'Title options and opening hooks',
    },
    {
      name: 'Narrative Spine & Central Thesis',
      patterns: [/narrative\s+spine/i, /central\s+thesis/i, /core\s+thesis/i, /thesis/i],
      description: 'The central thesis and the argument it rests on',
    },
    {
      name: 'Section-by-Section Outline',
      patterns: [/section[-\s]by[-\s]section/i, /structural\s+outline/i, /\boutline\b/i],
      description: 'An outline of every section with its argument and evidence',
    },
    {
      name: 'Voice, Tone & Cadence Guide',
      patterns: [/\bvoice\b/i, /\btone\b/i, /cadence/i, /prose\s+style/i],
      description: 'How the piece should sound',
    },
    {
      name: 'Closing',
      patterns: [/climax/i, /closing/i, /\bending\b/i, /final\s+(?:thought|realization|section)/i, /call\s+to\s+action/i],
      description: 'How the piece ends',
    },
  ],

  image_generation: [
    {
      name: 'Visual Concept & Art Direction',
      patterns: [/visual\s+concept/i, /art\s+direction/i, /creative\s+vision/i, /aesthetic\s+genre/i],
      description: 'Art direction, artistic medium, aesthetic genre, or visual mood',
    },
    {
      name: 'Master Prompt Block',
      patterns: [/master\s+(?:midjourney|flux|dall-e|prompt)/i, /copy-paste/i, /```/i],
      description: 'Copy-pasteable prompt block for Midjourney, FLUX, or DALL-E',
    },
    {
      name: 'Optical & Cinematography Specifications',
      patterns: [/optical/i, /cinematograph/i, /camera\s+lens/i, /focal\s+length/i, /lighting\s+setup/i, /aperture\s+&/i, /depth\s+of\s+field/i],
      description: 'Lens specifications, lighting setup, or camera optics',
    },
    {
      name: 'Color Palette & Film Stock Profile',
      patterns: [/color\s+palette/i, /film\s+stock/i, /kodak/i, /cinestill/i, /technicolor/i, /color\s+grading/i],
      description: 'Color palette profile, film stock emulation, or color grading',
    },
    {
      name: 'Negative Prompt & Exclusion List',
      patterns: [/negative\s+prompt/i, /exclusion\s+list/i, /exclusions/i, /what\s+to\s+avoid/i],
      description: 'Negative prompt or exclusions list for Stable Diffusion / ComfyUI',
    },
    {
      name: 'Composition & Aspect Ratio Variations',
      patterns: [/aspect\s+ratio/i, /composition\s+&/i, /composition\s+variations/i, /--ar/i, /16:9/i],
      description: 'Composition rules, aspect ratio parameters (--ar), or layout variations',
    },
  ],

  video_generation: [
    {
      name: 'Cinematic Scene Overview & Vision',
      patterns: [/cinematic\s+scene/i, /scene\s+overview/i, /creative\s+vision/i, /visual\s+premise/i],
      description: 'Cinematic premise, mood, pacing, and visual atmosphere',
    },
    {
      name: 'Master Video Generation Prompt Block',
      patterns: [/master\s+(?:runway|sora|luma|kling|video\s+prompt)/i, /copy-paste/i, /```/i],
      description: 'Copy-pasteable video prompt block for Runway, Luma, Kling, or Veo',
    },
    {
      name: 'Camera Motion & Shot Choreography',
      patterns: [/camera\s+(?:motion|movement|choreography|angle|tracking|pan|zoom|dolly)/i],
      description: 'Camera trajectories, movement speed, or shot choreography',
    },
    {
      name: 'Temporal Dynamics & Physical Simulation',
      patterns: [/temporal/i, /physics/i, /dynamics/i, /fps/i, /fluid/i, /slow-motion/i, /speed/i],
      description: 'Temporal dynamics, physics breakdown, particle movement, or speed ramping',
    },
    {
      name: 'Shot-by-Shot Timeline or Technical Settings',
      patterns: [/timeline/i, /storyboard/i, /shot-by-shot/i, /motion\s+control/i, /settings/i, /parameters/i],
      description: 'Storyboard timeline table or technical motion brush/slider settings',
    },
  ],

  coding_agent: [
    {
      name: 'Role Definition & Philosophy',
      patterns: [/role\s+definition/i, /role\s+persona/i, /operational\s+directives/i, /architectural\s+philosophy/i, /principal\s+software/i, /system\s+directive/i],
      description: 'Role definition and architectural persona',
    },
    {
      name: 'Master System Prompt Block',
      patterns: [/<directives>|<constraints>|<workflow>|<rules>/i, /master\s+system\s+prompt/i, /```/i],
      description: 'Enclosed system prompt block with strict XML directives or rules',
    },
    {
      name: 'File Tree Topology & Module Architecture',
      patterns: [/file\s+(?:tree|topology|structure)/i, /module\s+architecture/i, /directory\s+structure/i],
      description: 'Detailed file tree and component topology map',
    },
    {
      name: 'Strict Negative Constraints Matrix',
      // CODING_AGENT_MASTER_PROMPT asks for a <negative_constraints> block, so the underscore form counts too
      // (before, every coding answer failed this check and triggered a wasted repair call)
      patterns: [/negative[\s_-]+constraints/i, /anti-patterns/i, /never\s+do/i, /forbidden/i],
      description: 'Explicit negative constraints matrix (no any, no TODOs, no swallowed errors)',
    },
    {
      name: 'Concrete Schema Contracts',
      patterns: [/schema\s+contracts?/i, /interfaces?/i, /type\s+definitions?/i, /zod/i, /models?/i],
      description: 'Concrete TypeScript interfaces, Zod schemas, or data contracts',
    },
    {
      name: 'Phased Implementation & Verification Protocol',
      patterns: [/verification\s+(?:protocol|checklist)/i, /phased\s+implementation/i, /implementation\s+sequence/i, /automated\s+verification/i, /definition\s+of\s+done/i, /npm\s+run/i, /vitest/i, /tsc\s+--noEmit/i],
      description: 'Executable verification checklist with runnable terminal commands',
    },
  ],

  freelancer_brief: [
    {
      name: 'Executive Project Charter & Business Value',
      patterns: [/project\s+charter/i, /scope\s+of\s+work/i, /executive\s+summary/i, /business\s+value/i],
      description: 'Statement of work, executive summary, and project objectives',
    },
    {
      name: 'Phased Milestone Deliverables Matrix',
      patterns: [/milestone/i, /deliverables?\s+matrix/i, /acceptance\s+criteria/i],
      description: 'Phased milestones table with deliverables and acceptance criteria',
    },
    {
      name: 'UI/UX Design System Specification',
      patterns: [/design\s+system/i, /tokens?/i, /palette/i, /figma/i, /responsive/i],
      description: 'UI/UX design system tokens, color palettes, and responsive breakpoints',
    },
    {
      name: 'Client Handoff, Deployment & Staging',
      patterns: [/handoff/i, /handover/i, /sign-off/i, /warranty/i, /deployment/i, /staging/i, /hosting/i, /playbook/i],
      description: 'Client handoff instructions, hosting setup, and domain DNS configuration',
    },
    {
      name: 'Scope Boundary & Out-of-Scope Protection',
      patterns: [/out-of-scope/i, /scope\s+boundar/i, /change\s+order/i],
      description: 'Explicit out-of-scope clauses and change order protections',
    },
  ],

  hackathon_pitch: [
    {
      name: '10x Pitch Hook & Problem-Solution Narrative',
      patterns: [/elevator\s+hook/i, /30-second/i, /10x\s+pitch/i, /pitch\s+hook/i, /problem-solution/i, /why\s+now/i],
      description: 'High-impact 30-second opening statement and problem narrative',
    },
    {
      name: 'Live Demo Flow Script',
      patterns: [/demo\s+flow/i, /2-minute/i, /talking\s+points/i, /click\s+path/i],
      description: 'Step-by-step live demo script with presenter cues',
    },
    {
      name: 'Lean 24-Hour Sprint Plan',
      patterns: [/sprint\s+plan/i, /24-hour/i, /p0/i, /hours\s+0-12/i],
      description: 'P0 core happy path vs P1 stretch sprint timeline',
    },
    {
      name: 'Rapid Prototype Architecture & Shortcuts',
      patterns: [/rapid\s+prototype/i, /shortcuts?/i, /managed\s+integrations/i, /pre-built/i],
      description: 'Velocity-optimized stack shortcuts and managed APIs',
    },
    {
      name: 'Judging Rubric Optimization Checklist',
      patterns: [/judging\s+rubric/i, /scoring\s+tactics/i, /rubric\s+optimization/i, /10\/10/i],
      description: 'Tactical scoring guide for hackathon criteria',
    },
  ],

  no_code: [
    {
      name: 'Visual App Architecture & Platform Selection',
      patterns: [/visual\s+app/i, /platform\s+stack/i, /bubble/i, /flutterflow/i, /webflow/i],
      description: 'Visual builder selection and frontend/backend platform topology',
    },
    {
      name: 'Entity Relationship & Data Collections Table',
      patterns: [/data\s+collections?/i, /entity\s+relationship/i, /tables?/i, /linked\s+records/i],
      description: 'Collections table, data types, and linked records',
    },
    {
      name: 'Visual Page & Component Topology',
      patterns: [/page\s+topology/i, /page\s+hierarchy/i, /component\s+(?:hierarchy|layout)/i, /containers?/i, /repeating\s+groups?/i],
      description: 'Page layout hierarchy and component conditionals',
    },
    {
      name: 'Step-by-Step Automation & Webhook Recipes',
      patterns: [/automation/i, /webhook\s+recipes?/i, /make\.com/i, /zapier/i, /workflows?/i],
      description: 'Trigger-to-action automation flows and webhooks',
    },
    {
      name: 'No-Code Limits, Workarounds & Security Guardrails',
      patterns: [/no-code\s+limits?/i, /workarounds?/i, /security\s+guardrails/i, /backend\s+prox/i],
      description: 'API key security, pagination workarounds, and error retries',
    },
  ],
};

/**
 * Best guess of a prompt document's role from the sections it contains, for routes whose client does not send the
 * role (refine). Returns null unless one role clearly fits best: at least 60% of its sections found, and at least
 * 15 points ahead of the next role. Null means "unknown": callers then use only the universal rules.
 */
export function inferRoleFromDocument(text: string): string | null {
  if (!text || !text.trim()) return null;
  const scores = Object.entries(TARGET_BLUEPRINT_SECTIONS)
    .map(([role, sections]) => ({
      role,
      score: sections.filter((s) => s.patterns.some((p) => p.test(text))).length / Math.max(1, sections.length),
    }))
    .sort((a, b) => b.score - a.score);
  const [best, next] = scores;
  if (!best || best.score < 0.6 || best.score - (next?.score ?? 0) < 0.15) return null;
  return best.role;
}

export function isIdeaRequestingCode(ideaText?: string): boolean {
  if (!ideaText) return false;
  const lower = ideaText.toLowerCase();
  const codeIntents = [
    'react', 'next.js', 'vue', 'angular', 'svelte', 'typescript', 'javascript',
    'python', 'django', 'fastapi', 'flask', 'node', 'express',
    'build an app', 'create an app', 'write code', 'fullstack', 'backend', 'frontend',
    'software', 'web app', 'mobile app', 'api', 'database', 'sql', 'postgres',
    'repository', 'git', 'cli', 'library', 'npm package', 'pypi', 'shader code', 'glsl'
  ];
  return codeIntents.some(intent => lower.includes(intent));
}

export function detectForbiddenTerms(
  text: string,
  targetType: string,
  userIdea?: string
): { forbiddenTerms: string[]; fluffTerms: string[]; lazyStubs: string[] } {
  if (!text) return { forbiddenTerms: [], fluffTerms: [], lazyStubs: [] };

  const forbiddenTerms: string[] = [];
  const fluffTerms: string[] = [];
  const lazyStubs: string[] = [];

  const lowerText = text.toLowerCase();
  const key = roleKey(targetType);
  const isMedia = key === 'image_generation' || key === 'video_generation';
  const ideaWantsCode = isIdeaRequestingCode(userIdea);

  if (isMedia && !ideaWantsCode) {
    for (const term of MEDIA_FORBIDDEN_CODING_TERMS) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefix = /^\w/.test(term) ? '\\b' : '';
      const suffix = /\w$/.test(term) ? '\\b' : '';
      const regex = new RegExp(`${prefix}${escaped}${suffix}`, 'i');
      if (regex.test(lowerText)) {
        forbiddenTerms.push(term);
      }
    }
  }

  for (const phrase of CONVERSATIONAL_FLUFF_PHRASES) {
    if (lowerText.includes(phrase)) {
      fluffTerms.push(phrase);
    }
  }

  for (const stub of LAZY_STUB_PHRASES) {
    if (lowerText.includes(stub.toLowerCase())) {
      lazyStubs.push(stub);
    }
  }

  return { forbiddenTerms, fluffTerms, lazyStubs };
}

export function validateQuestionsOutput(
  rawText: string,
  targetType: string,
  userIdea?: string
): ValidationResult<Question[]> {
  const issues: ValidationIssue[] = [];

  if (!rawText || !rawText.trim()) {
    issues.push({ type: 'length', message: 'Questions response is empty' });
    return { isValid: false, issues, forbiddenTermsFound: [], missingSections: [] };
  }

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: any;
  try {
    const directParse = JSON.parse(cleaned);
    parsed = Array.isArray(directParse) ? directParse : directParse.questions || directParse.data;
  } catch (err: any) {
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        issues.push({ type: 'schema', message: `Malformed JSON array: ${err.message}` });
        return { isValid: false, issues, forbiddenTermsFound: [], missingSections: [] };
      }
    } else {
      issues.push({ type: 'schema', message: 'Output does not contain a JSON array of questions' });
      return { isValid: false, issues, forbiddenTermsFound: [], missingSections: [] };
    }
  }

  const shape = checkQuestionShape(parsed);
  if (!shape.ok) {
    for (const error of shape.issues) {
      issues.push({
        type: 'schema',
        message: error.path ? `${error.path}: ${error.message}` : error.message,
      });
    }
  }

  const fullTextToScan = JSON.stringify(parsed);
  const { forbiddenTerms, fluffTerms } = detectForbiddenTerms(fullTextToScan, targetType, userIdea);

  if (forbiddenTerms.length > 0) {
    for (const term of forbiddenTerms) {
      issues.push({
        type: 'forbidden_term',
        term,
        message: `Question text contains forbidden coding term "${term}" for target "${targetType}"`,
      });
    }
  }

  if (fluffTerms.length > 0) {
    for (const term of fluffTerms) {
      issues.push({
        type: 'fluff',
        term,
        message: `Output contains conversational filler phrase "${term}"`,
      });
    }
  }

  const isValid = issues.length === 0 && shape.ok;
  return {
    isValid,
    issues,
    forbiddenTermsFound: forbiddenTerms,
    missingSections: [],
    data: isValid && shape.ok ? shape.data : undefined,
  };
}

export function validateSynthesisOutput(
  output: string,
  targetType: string,
  userIdea?: string
): ValidationResult<string> {
  const issues: ValidationIssue[] = [];
  const missingSections: string[] = [];

  const trimmed = (output || '').trim();

  if (
    (trimmed.startsWith('{') && (trimmed.includes('"promptText"') || trimmed.includes('"updatedMarkdown"') || trimmed.includes('"content"'))) ||
    (trimmed.startsWith('```json') && trimmed.endsWith('```'))
  ) {
    issues.push({
      type: 'wrapper_leak',
      message: 'Output leaked a raw JSON wrapper object instead of pure markdown specification.',
    });
  }

  if (trimmed.includes('BEDROCK_CORE_GUARDRAILS') || trimmed.includes('<UNTRUSTED_USER_INPUT>')) {
    issues.push({
      type: 'wrapper_leak',
      message: 'Output leaked internal framework prompt delimiters into the user document.',
    });
  }

  if (!output || trimmed.length < 150) {
    issues.push({
      type: 'length',
      message: `Prompt output is too short (${trimmed.length} characters). Minimum required is 150 characters.`,
    });
  }

  const { forbiddenTerms, fluffTerms, lazyStubs } = detectForbiddenTerms(trimmed, targetType, userIdea);

  for (const term of forbiddenTerms) {
    issues.push({
      type: 'forbidden_term',
      term,
      message: `Prompt contains forbidden coding term "${term}" for media target "${targetType}".`,
    });
  }

  for (const fluff of fluffTerms) {
    issues.push({
      type: 'fluff',
      term: fluff,
      message: `Prompt begins or contains conversational filler "${fluff}".`,
    });
  }

  for (const stub of lazyStubs) {
    issues.push({
      type: 'forbidden_term',
      term: stub,
      message: `Prompt contains lazy placeholder stub "${stub}". Full implementation is required.`,
    });
  }

  const requirements = TARGET_BLUEPRINT_SECTIONS[roleKey(targetType)] || TARGET_BLUEPRINT_SECTIONS.coding_agent;
  for (const req of requirements) {
    const hasSection = req.patterns.some(pattern => pattern.test(trimmed));
    if (!hasSection) {
      missingSections.push(req.name);
      issues.push({
        type: 'schema',
        section: req.name,
        message: `Missing required blueprint section: "${req.name}" (${req.description}).`,
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    forbiddenTermsFound: forbiddenTerms,
    missingSections,
    data: output,
  };
}

export function buildRepairMessage(params: {
  previousOutput: string;
  validation: ValidationResult<any>;
  targetType: string;
  userIdea: string;
  mode: 'synthesis' | 'questions' | 'refine';
}): { repairUserPrompt: string; repairSystemPrompt: string } {
  const { previousOutput, validation, targetType, userIdea, mode } = params;

  const forbiddenTermsStr = validation.forbiddenTermsFound.join(', ');
  const missingSectionsStr = validation.missingSections.map(s => `  - ${s}`).join('\n');
  const issuesListStr = validation.issues.map(i => `  • ${i.message}`).join('\n');

  if (mode === 'questions') {
    const repairSystemPrompt = `You are Bedrock's Quality Guard Engine.
Your task is to fix and regenerate the clarifying questions that previously failed validation.
CRITICAL MANDATES:
1. Output MUST be strictly a valid raw JSON array of 3 to 4 objects without markdown fences, comments, or backticks.
2. Each object MUST have "id" (string), "questionText" (string), "questionType" ('single_select' | 'multi_select' | 'free_text'), and "options" (array of strings for select types).
${validation.forbiddenTermsFound.length > 0 ? `3. STRICT FORBIDDEN TERMS: The following terms are 100% prohibited: [${forbiddenTermsStr}]. DO NOT mention code, databases, or frameworks.` : ''}
4. NO conversational fluff or preamble.`;

    const repairUserPrompt = `REPAIR DIRECTIVE:
Your previous question generation failed Bedrock quality validation for target "${targetType}".

Validation Errors Found:
${issuesListStr}

Initial User Project Idea:
${userIdea}

Regenerate exactly 3 to 4 high-leverage clarifying questions as a pure JSON array now, resolving every error above.`;

    return { repairUserPrompt, repairSystemPrompt };
  }

  const repairSystemPrompt = `You are Bedrock's Senior Production Quality Auditor and Chief Architect.
The previous prompt synthesis failed Bedrock production quality validation and violated mandatory architectural guardrails.
You MUST immediately regenerate the entire specification adhering strictly to the required blueprint schema.

CRITICAL REPAIR RULES:
1. ZERO CONVERSATIONAL FLUFF: Never output greetings, preambles, or conversational transitions. Start directly with '# [Project Title] - Master Specification'.
2. PURGE ALL FORBIDDEN TERMS: ${validation.forbiddenTermsFound.length > 0 ? `The target is "${targetType}". The following forbidden terms were detected and MUST be eliminated completely: [${forbiddenTermsStr}]. DO NOT mention any software frameworks, npm packages, or coding syntax.` : 'Eliminate all lazy stubs, placeholders, and filler.'}
3. ENFORCE ALL REQUIRED BLUEPRINT SECTIONS: The output MUST explicitly contain every missing section:
${missingSectionsStr}
4. PUBLICATION-GRADE MARKDOWN: Output strictly in pure GitHub-flavored Markdown. Do NOT wrap in JSON objects, quotes, or codeblocks.`;

  const excerpt = previousOutput.length > 600
    ? previousOutput.slice(0, 300) + '\n...[trimmed]...\n' + previousOutput.slice(-300)
    : previousOutput;

  const repairUserPrompt = `CRITICAL ARCHITECTURAL REPAIR REQUIRED:
Target Specification Type: "${targetType}"
Project Concept: "${userIdea}"

YOUR PREVIOUS ATTEMPT FAILED WITH THE FOLLOWING VALIDATION VIOLATIONS:
${issuesListStr}

${validation.forbiddenTermsFound.length > 0 ? `❌ FORBIDDEN TERMS DETECTED: [${forbiddenTermsStr}]\nThis target is "${targetType}". Software/programming terms are strictly forbidden. You must completely replace them with domain-appropriate specifications.` : ''}

${validation.missingSections.length > 0 ? `❌ MISSING REQUIRED SECTIONS:\n${missingSectionsStr}` : ''}

Previous Flawed Attempt Excerpt:
"""
${excerpt}
"""

Regenerate the entire production-grade prompt document from scratch now.
Resolve ALL violations listed above, include EVERY required blueprint section, remove all forbidden terms, and begin directly with the document title in Markdown.`;

  return { repairUserPrompt, repairSystemPrompt };
}

export function sanitizePromptOutput(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  if (cleaned.startsWith('{') && cleaned.includes('"promptText"')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.promptText === 'string') {
        cleaned = parsed.promptText.trim();
      }
    } catch {
      const match = cleaned.match(/"promptText"\s*:\s*"([\s\S]*?)"\s*\}?$/);
      if (match && match[1]) {
        cleaned = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }
  }

  const preamblePatterns = [
    /^(?:Sure|Certainly|Here is|Here's|Below is)[^\n]*\n+/i,
    /^(?:Here is your (?:bespoke|production|updated|generated)?\s*prompt[^\n]*)\n+/i,
  ];
  for (const pat of preamblePatterns) {
    cleaned = cleaned.replace(pat, '').trim();
  }

  const signoffPatterns = [
    /\n+(?:I hope this helps|Let me know if you need|Feel free to ask)[^\n]*$/i,
    /\n+(?:Happy prompting!|Enjoy creating!)[^\n]*$/i,
  ];
  for (const pat of signoffPatterns) {
    cleaned = cleaned.replace(pat, '').trim();
  }

  return stripInternalChecklist(cleaned);
}

/**
 * Removes Bedrock's own internal checklist ("PRE-FLIGHT SILENT SELF-AUDIT", meant for the model only) when a model
 * copies it into the document: GPT-4o-mini did in 11 of 21 documents in the 2026-11-03 eval. The section runs from
 * its heading (or bold label) to the next heading or the end of the document.
 */
export function stripInternalChecklist(text: string): string {
  return text
    .replace(/(^|\n)(?:#{1,6}\s*|\*\*)[^\n]*SELF-AUDIT[^\n]*\n[\s\S]*?(?=\n#{1,6}\s|$)/gi, '$1')
    .trim();
}
