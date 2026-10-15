import { describe, it, expect } from 'vitest';
import {
  detectForbiddenTerms,
  isIdeaRequestingCode,
  validateQuestionsOutput,
  validateSynthesisOutput,
  buildRepairMessage,
  sanitizePromptOutput,
} from '../validation';

describe('Prompt Validation & Anti-Hallucination Guardrails', () => {
  describe('isIdeaRequestingCode', () => {
    it('detects when an idea is requesting software/code', () => {
      expect(isIdeaRequestingCode('Build a React web app for photo filtering')).toBe(true);
      expect(isIdeaRequestingCode('Create a python script that calls image APIs')).toBe(true);
      expect(isIdeaRequestingCode('Design a fullstack dashboard')).toBe(true);
    });

    it('returns false for pure media/creative prompts', () => {
      expect(isIdeaRequestingCode('A cinematic photo of a red apple on a rustic table')).toBe(false);
      expect(isIdeaRequestingCode('Cyberpunk drone shot flying through neo-Tokyo in the rain')).toBe(false);
      expect(isIdeaRequestingCode('Oil painting of an ancient warrior')).toBe(false);
    });
  });

  describe('detectForbiddenTerms', () => {
    it('detects forbidden coding terms for image_generation when idea is creative', () => {
      const sampleText = 'To create this image, you should use React 19, TypeScript, and run npm install packages.';
      const result = detectForbiddenTerms(sampleText, 'image_generation', 'A photo of an apple');
      expect(result.forbiddenTerms).toContain('react');
      expect(result.forbiddenTerms).toContain('react 19');
      expect(result.forbiddenTerms).toContain('typescript');
      expect(result.forbiddenTerms).toContain('npm install');
      expect(result.forbiddenTerms).toContain('npm');
    });

    it('does NOT false-positive on word substrings like "reactive" or "reactor"', () => {
      const sampleText = 'The lighting causes a reactive glow and vivid highlights on the reactor core.';
      const result = detectForbiddenTerms(sampleText, 'image_generation', 'Sci-fi reactor illustration');
      expect(result.forbiddenTerms).not.toContain('react');
    });

    it('allows coding terms when target is coding_agent', () => {
      const sampleText = 'Use React 19, Next.js 15 App Router, TypeScript, and Prisma.';
      const result = detectForbiddenTerms(sampleText, 'coding_agent', 'Build a SaaS dashboard');
      expect(result.forbiddenTerms).toHaveLength(0);
    });

    it('detects conversational fluff across all target types', () => {
      const sampleText = 'Sure, here is your prompt!\n# Project Title\nI hope this helps!';
      const result = detectForbiddenTerms(sampleText, 'coding_agent');
      expect(result.fluffTerms).toContain('sure, here is');
      expect(result.fluffTerms).toContain('i hope this helps');
    });

    it('detects lazy placeholder stubs', () => {
      const sampleText = 'function run() {\n  // TODO: implement\n}';
      const result = detectForbiddenTerms(sampleText, 'coding_agent');
      expect(result.lazyStubs).toContain('// todo: implement');
    });
  });

  describe('validateQuestionsOutput', () => {
    it('validates compliant questions JSON array', () => {
      const validQuestionsJson = JSON.stringify([
        {
          id: 'q1',
          questionText: 'What is the visual art style and medium for this image?',
          questionType: 'single_select',
          options: ['35mm Film Photography', 'Digital Concept Art', 'Oil on Canvas'],
        },
        {
          id: 'q2',
          questionText: 'What lighting setup and atmospheric mood do you prefer?',
          questionType: 'single_select',
          options: ['Golden Hour Sunlight', 'Dramatic Chiaroscuro', 'Studio High-Key'],
        },
        {
          id: 'q3',
          questionText: 'What aspect ratio and camera framing do you envision?',
          questionType: 'single_select',
          options: ['16:9 Widescreen Cinema', '9:16 Vertical Story', '1:1 Square Portrait'],
        },
      ]);

      const validation = validateQuestionsOutput(validQuestionsJson, 'image_generation', 'An apple');
      expect(validation.isValid).toBe(true);
      expect(validation.data).toHaveLength(3);
      expect(validation.forbiddenTermsFound).toHaveLength(0);
    });

    it('flags forbidden coding terms in questions for visual targets', () => {
      const badQuestionsJson = JSON.stringify([
        {
          id: 'q1',
          questionText: 'Which React framework and PostgreSQL database should we configure?',
          questionType: 'single_select',
          options: ['Next.js + Prisma', 'Vite + Drizzle'],
        },
        {
          id: 'q2',
          questionText: 'What camera angle do you want for the apple photo?',
          questionType: 'free_text',
        },
      ]);

      const validation = validateQuestionsOutput(badQuestionsJson, 'image_generation', 'An apple');
      expect(validation.isValid).toBe(false);
      expect(validation.forbiddenTermsFound).toContain('react');
      expect(validation.forbiddenTermsFound).toContain('postgresql');
    });

    it('flags malformed or non-array outputs', () => {
      const invalidJson = 'Not valid JSON at all';
      const validation = validateQuestionsOutput(invalidJson, 'coding_agent');
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.type === 'schema')).toBe(true);
    });
  });

  describe('validateSynthesisOutput', () => {
    it('flags prompt containing forbidden terms for image generation', () => {
      const badPrompt = `
# Vintage Apple Photo Master Prompt
Visual Concept: A photorealistic vintage red apple sitting on an oak dining table.
Master Midjourney v6.1 Prompt:
\`\`\`
a ripe red honeycrisp apple on rustic wood table, soft window light --ar 16:9 --v 6.1
\`\`\`
Optical & Cinematography:
85mm f/1.4 lens, natural window lighting.
Color Palette:
Kodak Portra 400 warm earth tones.
Negative Prompt:
blurry, low resolution, watermark, deformed.
Composition Variations:
16:9 cinematic landscape.
Implementation:
To render this, use React 19 with TypeScript and npm install three.js.
      `;

      const validation = validateSynthesisOutput(badPrompt, 'image_generation', 'A photo of an apple');
      expect(validation.isValid).toBe(false);
      expect(validation.forbiddenTermsFound).toContain('react');
      expect(validation.forbiddenTermsFound).toContain('typescript');
      expect(validation.forbiddenTermsFound).toContain('npm install');
    });

    it('flags missing required sections for image generation', () => {
      const incompletePrompt = `
# Vintage Apple
A photo of an apple on a table with warm lighting. It looks delicious and artistic.
A copy-paste prompt: "red apple on a table".
This concludes the guide with more detail to satisfy the length requirement.
      `;

      const validation = validateSynthesisOutput(incompletePrompt, 'image_generation', 'An apple');
      expect(validation.isValid).toBe(false);
      expect(validation.missingSections).toContain('Optical & Cinematography Specifications');
      expect(validation.missingSections).toContain('Negative Prompt & Exclusion List');
      expect(validation.missingSections).toContain('Composition & Aspect Ratio Variations');
    });

    it('passes for a fully compliant image generation prompt without forbidden terms', () => {
      const validPrompt = `
# Crisp Honeycrisp Apple - Production AI Image Master Specification

## 1. Visual Concept & Art Direction
Visual premise: A macro culinary photograph of an organic Honeycrisp apple resting on an aged reclaimed oak farmhouse table.
Aesthetic genre: High-end editorial food photography reminiscent of Kinfolk magazine.

## 2. Master Prompt Block
### Master Midjourney v6.1 Prompt
\`\`\`
editorial food photography of a single heirloom honeycrisp apple, morning sunlight from left window, water droplets on glossy skin, rustic aged oak surface, 85mm portrait lens, shallow depth of field, photorealistic, cinematic realism --ar 16:9 --v 6.1 --style raw --stylize 250
\`\`\`

## 3. Optical & Cinematography Specifications
- Camera Lens: Hasselblad 500C with 85mm f/1.4 G-Master lens.
- Lighting Setup: 5600K daylight key light through diffused window sheer, white foam core bounce for gentle fill.
- Aperture & Depth of Field: f/2.0 producing creamy bokeh separation.

## 4. Color Palette & Film Stock Profile
- Film Stock Emulation: Kodak Portra 400 with rich crimson reds (#8B0000) and warm rustic amber wood grain (#7B3F00).
- Dynamic Range: Clean highlight roll-off with deep preserved shadows.

## 5. Negative Prompt & Exclusion List
Negative prompt for Stable Diffusion XL / ComfyUI:
\`\`\`
blurry, low resolution, deformed stem, plastic texture, artificial waxy sheen, watermark, signature, oversaturated, text, logo
\`\`\`

## 6. Composition & Aspect Ratio Variations
- 16:9 Cinema Widescreen: Apple placed at right rule-of-thirds intersection with kitchen background blur.
- 9:16 Vertical Story: Tight vertical composition focusing on the crown and droplet details.
      `;

      const validation = validateSynthesisOutput(validPrompt, 'image_generation', 'A photo of an apple');
      expect(validation.isValid).toBe(true);
      expect(validation.missingSections).toHaveLength(0);
      expect(validation.forbiddenTermsFound).toHaveLength(0);
    });

    it('flags leaked JSON wrapper objects', () => {
      const leakedJson = JSON.stringify({
        promptText: '# System Directive\nThis is leaked json wrapper',
      });
      const validation = validateSynthesisOutput(leakedJson, 'coding_agent', 'App idea');
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.type === 'wrapper_leak')).toBe(true);
    });
  });

  describe('buildRepairMessage', () => {
    it('generates actionable repair prompt with forbidden terms and missing sections', () => {
      const validation = {
        isValid: false,
        issues: [
          { type: 'forbidden_term' as const, term: 'react', message: 'Contains forbidden term react' },
          { type: 'schema' as const, section: 'Negative Prompt & Exclusion List', message: 'Missing negative prompt' },
        ],
        forbiddenTermsFound: ['react', 'typescript'],
        missingSections: ['Negative Prompt & Exclusion List'],
      };

      const repair = buildRepairMessage({
        previousOutput: 'Flawed prompt mentioning react and typescript',
        validation,
        targetType: 'image_generation',
        userIdea: 'A photo of a red apple',
        mode: 'synthesis',
      });

      expect(repair.repairUserPrompt).toContain('FORBIDDEN TERMS DETECTED: [react, typescript]');
      expect(repair.repairUserPrompt).toContain('Negative Prompt & Exclusion List');
      expect(repair.repairUserPrompt).toContain('A photo of a red apple');
      expect(repair.repairSystemPrompt).toContain('PURGE ALL FORBIDDEN TERMS');
    });
  });

  describe('sanitizePromptOutput', () => {
    it('strips conversational preambles and postambles', () => {
      const raw = 'Sure, here is your generated prompt!\n# Project Title\nContent here.\nI hope this helps!';
      const sanitized = sanitizePromptOutput(raw);
      expect(sanitized.startsWith('# Project Title')).toBe(true);
      expect(sanitized.endsWith('Content here.')).toBe(true);
      expect(sanitized).not.toContain('Sure, here is');
      expect(sanitized).not.toContain('I hope this helps');
    });

    it('extracts text from leaked JSON wrappers', () => {
      const leaked = JSON.stringify({ promptText: '# Unwrapped Title\nSpecification body' });
      const sanitized = sanitizePromptOutput(leaked);
      expect(sanitized).toBe('# Unwrapped Title\nSpecification body');
    });
  });

  describe('Validation & Retry Orchestration Simulation', () => {
    it('simulates a failed synthesis attempt repaired on the single retry turn', async () => {
      let callCount = 0;
      const initialFailedOutput = `
# Vintage Apple Photo
Visual Concept: An apple on a rustic table.
Master Midjourney Prompt: \`\`\`apple on table\`\`\`
Implementation: Run npm install react and use React 19 to display this.
`;

      const repairedValidOutput = `
# Vintage Apple Photo - Master Production AI Image Specification

## 1. Visual Concept & Art Direction
Visual premise: Macro studio photography of a fresh heirloom Honeycrisp apple resting on an aged reclaimed oak table.
Aesthetic genre: Editorial fine-art food photography.

## 2. Master Prompt Block
\`\`\`
macro editorial photo of a fresh honeycrisp apple on rustic oak table, soft morning window light, glistening water droplets, 85mm f/1.4 lens, photorealistic, 8k --ar 16:9 --v 6.1 --style raw
\`\`\`

## 3. Optical & Cinematography Specifications
- Camera Lens: Sony A7R V with 85mm f/1.4 G-Master lens.
- Lighting Setup: 5600K diffused north-facing window light with foam-board fill bounce.
- Aperture & Depth of Field: f/2.0 producing silky shallow depth of field.

## 4. Color Palette & Film Stock Profile
- Film Stock Emulation: Kodak Portra 400 color science with deep ruby red (#9B111E) and rich warm timber wood grain.

## 5. Negative Prompt & Exclusion List
\`\`\`
blurry, low resolution, artificial plastic texture, waxy sheen, watermark, text, signature, cartoon, 3d render
\`\`\`

## 6. Composition & Aspect Ratio Variations
- 16:9 Cinematic Widescreen: Primary shot with negative space on the left.
- 1:1 Square Portrait: Balanced centerpiece for gallery prints.
`;

      // Simulated LLM caller that fails on attempt 1 and succeeds on attempt 2 (repair retry)
      const mockLlmCall = async (_userPrompt: string, _systemPrompt?: string): Promise<string> => {
        callCount++;
        if (callCount === 1) {
          return initialFailedOutput;
        }
        return repairedValidOutput;
      };

      // Execution of Validation + Single Retry Protocol
      const targetType = 'image_generation';
      const userIdea = 'A photo of an apple';

      let output = await mockLlmCall('initial prompt', 'initial system');
      let validation = validateSynthesisOutput(output, targetType, userIdea);

      expect(validation.isValid).toBe(false);
      expect(validation.forbiddenTermsFound).toContain('react');

      // Retry once if invalid
      if (!validation.isValid) {
        const repair = buildRepairMessage({
          previousOutput: output,
          validation,
          targetType,
          userIdea,
          mode: 'synthesis',
        });

        output = await mockLlmCall(repair.repairUserPrompt, repair.repairSystemPrompt);
        validation = validateSynthesisOutput(output, targetType, userIdea);
      }

      expect(callCount).toBe(2); // Exactly 1 retry attempt
      expect(validation.isValid).toBe(true);
      expect(validation.forbiddenTermsFound).toHaveLength(0);
      expect(validation.missingSections).toHaveLength(0);
    });

    it('simulates a question generation failure repaired on the single retry turn', async () => {
      let callCount = 0;
      const initialFailedJson = JSON.stringify([
        {
          id: 'q1',
          questionText: 'What React version and Prisma database will you use for this image?',
          questionType: 'single_select',
          options: ['Next.js', 'Vite'],
        },
      ]);

      const repairedValidJson = JSON.stringify([
        {
          id: 'q1',
          questionText: 'What artistic medium and style do you envision for this image?',
          questionType: 'single_select',
          options: ['35mm Film Photography', 'Digital Matte Painting', 'Charcoal Sketch'],
        },
        {
          id: 'q2',
          questionText: 'What camera lens and lighting atmosphere should be applied?',
          questionType: 'single_select',
          options: ['85mm Golden Hour', 'Wide-Angle Dramatic Noir', 'Macro Studio Softbox'],
        },
        {
          id: 'q3',
          questionText: 'What aspect ratio and framing composition is required?',
          questionType: 'single_select',
          options: ['16:9 Cinema Widescreen', '9:16 Vertical Story', '1:1 Square'],
        },
      ]);

      const mockLlmCall = async (): Promise<string> => {
        callCount++;
        if (callCount === 1) return initialFailedJson;
        return repairedValidJson;
      };

      const targetType = 'image_generation';
      const userIdea = 'A photo of a dragon';

      let raw = await mockLlmCall();
      let validation = validateQuestionsOutput(raw, targetType, userIdea);
      expect(validation.isValid).toBe(false);

      if (!validation.isValid) {
        const repair = buildRepairMessage({
          previousOutput: raw,
          validation,
          targetType,
          userIdea,
          mode: 'questions',
        });
        expect(repair).toBeDefined();

        raw = await mockLlmCall();
        validation = validateQuestionsOutput(raw, targetType, userIdea);
      }

      expect(callCount).toBe(2);
      expect(validation.isValid).toBe(true);
      expect(validation.data).toHaveLength(3);
    });
  });
});
