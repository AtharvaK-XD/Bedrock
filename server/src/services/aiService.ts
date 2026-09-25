import { config } from '../config.js';

export interface Question {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface RefineResult {
  updatedMarkdown: string;
  summary: string;
}

export class AiService {
  private static REQUEST_TIMEOUT_MS = 30000;

  /**
   * Safe fetch with AbortSignal timeout to prevent hanging connections
   */
  private static async safeFetch(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Cleans AI text output (strips markdown code blocks if raw JSON is expected)
   */
  private static cleanJsonString(raw: string): string {
    return raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  /**
   * Primary completion runner with automatic multi-provider fallback
   */
  public static async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    // 1. Try Groq with active ultra-fast models
    if (config.ai.groqKey) {
      const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
      for (const model of groqModels) {
        try {
          const res = await this.safeFetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.ai.groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.5,
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
          }
        } catch (err: any) {
          console.warn(`[AiService] Groq model ${model} failed (${err.message}), trying next...`);
        }
      }
    }

    // 2. Try OpenRouter with resilient fallback models
    if (config.ai.openRouterKey) {
      const openRouterModels = ['openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free'];
      for (const model of openRouterModels) {
        try {
          const res = await this.safeFetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.ai.openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://bedrock.app',
              'X-Title': 'Bedrock Studio',
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.5,
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
          }
        } catch (err: any) {
          console.warn(`[AiService] OpenRouter model ${model} failed (${err.message}), trying next...`);
        }
      }
    }

    // 3. Try Gemini
    if (config.ai.geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.ai.geminiKey}`;
        const body: any = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5 },
        };
        if (systemPrompt) {
          body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const res = await this.safeFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) return content;
        }
      } catch (err: any) {
        console.warn(`[AiService] Gemini call failed (${err.message})`);
      }
    }

    throw new Error('All configured AI providers failed to respond. Please verify backend API keys.');
  }

  /**
   * Generates 3-5 structured clarifying questions
   */
  public static async generateQuestions(ideaText: string, targetType: string): Promise<Question[]> {
    const prompt = `You are an expert product manager and prompt architect. The user has an idea for a ${targetType}.
Idea: "${ideaText}"

Generate exactly 3 to 5 highly relevant clarifying questions to help refine this idea into a production-grade prompt.
Respond ONLY with a valid JSON array of objects. Do not include markdown codeblocks or backticks.
Each object must have:
- "id": a unique string (e.g. "q1", "q2")
- "questionText": clear, concise question
- "questionType": strictly one of "free_text", "single_select", or "multi_select"
- "options": an array of string choices (required if questionType is single_select or multi_select, omit if free_text).`;

    try {
      const raw = await this.complete(prompt);
      const cleaned = this.cleanJsonString(raw);
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Question[];
      }
    } catch {
      console.warn('[AiService] Using standard question template fallback');
    }

    return [
      {
        id: 'q1',
        questionText: 'What is the primary target tech stack or ecosystem for this project?',
        questionType: 'single_select',
        options: ['React / TypeScript / Node.js', 'Next.js Fullstack', 'Python / FastAPI', 'Mobile (React Native / Flutter)', 'No-Code / Low-Code'],
      },
      {
        id: 'q2',
        questionText: 'What key features are required for the initial MVP?',
        questionType: 'free_text',
      },
      {
        id: 'q3',
        questionText: 'What external APIs or integrations will be needed?',
        questionType: 'multi_select',
        options: ['AI / LLM APIs', 'Database / ORM', 'Authentication / OAuth', 'Payment Processing (Stripe)', 'Third-Party Webhooks'],
      },
    ];
  }

  /**
   * Synthesizes comprehensive Project Brief and System Prompt
   */
  public static async synthesizePrompt(
    idea: { ideaText: string; targetType: string },
    answers: Array<{ questionId: string; value: string | string[] }>,
    questions: Question[]
  ): Promise<string> {
    const answersText = answers
      .map((a) => {
        const q = questions.find((item) => item.id === a.questionId);
        const val = Array.isArray(a.value) ? a.value.join(', ') : a.value;
        return `Q: ${q?.questionText || a.questionId}\nA: ${val}`;
      })
      .join('\n\n');

    const prompt = `You are an elite software architect and lead prompt engineer.
A user wants to build a project.

Target Output Type: ${idea.targetType}
Initial Idea: ${idea.ideaText}

Clarifying Questions & Answers:
${answersText}

Based on this specification, generate a comprehensive, production-grade Project Brief & Implementation Plan.
Include the following distinct sections in clean GitHub-Flavored Markdown:
1. Executive Summary & Goal
2. Core Master System Prompt (Formatted in a codeblock ready to paste into Claude, Cursor, Windsurf, or Gemini)
3. Architecture, Tech Stack & Data Models
4. Key Implementation Milestones & Edge Cases
5. Quality Evaluation Rubric`;

    return await this.complete(prompt);
  }

  /**
   * Refines existing prompt markdown based on user feedback
   */
  public static async refinePrompt(currentPrompt: string, followUp: string): Promise<RefineResult> {
    const prompt = `You are an expert prompt engineer. You have drafted this markdown document:
---
${currentPrompt}
---

The user has submitted this follow-up refinement request:
"${followUp}"

Please completely rewrite the markdown document incorporating this feedback cleanly.
Respond ONLY with a valid JSON object. Do not include markdown code fence around the JSON.
The JSON object must contain exactly:
- "updatedMarkdown": The full, revised markdown document as a string.
- "summary": A concise summary (2-3 sentences) explaining what was modified.`;

    try {
      const raw = await this.complete(prompt);
      const cleaned = this.cleanJsonString(raw);
      const parsed = JSON.parse(cleaned);
      if (parsed.updatedMarkdown && parsed.summary) {
        return parsed as RefineResult;
      }
    } catch {
      // Fallback
    }

    const raw = await this.complete(prompt);
    return {
      updatedMarkdown: raw.startsWith('{') ? currentPrompt : raw,
      summary: `Updated prompt incorporating user feedback: "${followUp}"`,
    };
  }

  /**
   * Tests prompt against specific target AI model
   */
  public static async testPrompt(
    modelId: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    // 1. HuggingFace models
    if (modelId.startsWith('hf/')) {
      if (!config.ai.huggingFaceKey) {
        throw new Error('Hugging Face API Key is not configured on backend.');
      }
      const realModel = modelId.replace('hf/', '');
      const res = await this.safeFetch(
        `https://api-inference.huggingface.co/models/${realModel}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.ai.huggingFaceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: realModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
          }),
        }
      );
      if (!res.ok) throw new Error(`HuggingFace returned HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content || '';
    }

    // 2. OpenRouter models
    if (modelId.includes('/')) {
      if (!config.ai.openRouterKey) {
        throw new Error('OpenRouter API Key is not configured on backend.');
      }
      const res = await this.safeFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bedrock.app',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter returned HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content || '';
    }

    // 3. Gemini models
    if (modelId.toLowerCase().includes('gemini')) {
      if (config.ai.geminiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${config.ai.geminiKey}`;
        const res = await this.safeFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.7 },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }
      // Fallback
      return await this.complete(userPrompt, systemPrompt);
    }

    // 4. Default to Groq / OpenAI GPT OSS or OpenRouter
    return await this.complete(userPrompt, systemPrompt);
  }
}
