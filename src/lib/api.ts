export interface IdeaPayload {
  ideaText: string;
  targetType: 'coding_agent' | 'freelancer_brief' | 'hackathon_pitch' | 'no_code';
}

export interface Question {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface Answer {
  questionId: string;
  value: string | string[];
}

const STORAGE_KEY_API_KEYS = 'bedrock_api_keys';

export function getActiveApiKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_API_KEYS);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      geminiKey: (parsed.geminiKey || import.meta.env.VITE_GEMINI_API_KEY || '').trim(),
      groqKey: (parsed.groqKey || import.meta.env.VITE_GROQ_API_KEY || '').trim(),
      openAiKey: (parsed.openAiKey || import.meta.env.VITE_OPENAI_API_KEY || '').trim(),
      anthropicKey: (parsed.anthropicKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '').trim(),
      openRouterKey: (parsed.openRouterKey || import.meta.env.VITE_OPENROUTER_API_KEY || '').trim(),
      huggingFaceKey: (parsed.huggingFaceKey || import.meta.env.VITE_HUGGINGFACE_API_KEY || '').trim(),
      ollamaEndpoint: (parsed.ollamaEndpoint || 'http://localhost:11434').trim(),
    };
  } catch {
    return {
      geminiKey: (import.meta.env.VITE_GEMINI_API_KEY || '').trim(),
      groqKey: (import.meta.env.VITE_GROQ_API_KEY || '').trim(),
      openAiKey: (import.meta.env.VITE_OPENAI_API_KEY || '').trim(),
      anthropicKey: (import.meta.env.VITE_ANTHROPIC_API_KEY || '').trim(),
      openRouterKey: (import.meta.env.VITE_OPENROUTER_API_KEY || '').trim(),
      huggingFaceKey: (import.meta.env.VITE_HUGGINGFACE_API_KEY || '').trim(),
      ollamaEndpoint: 'http://localhost:11434',
    };
  }
}

export const generateQuestions = async (payload: IdeaPayload): Promise<Question[]> => {
  const keys = getActiveApiKeys();

  const prompt = `You are an expert product manager. The user has an idea for a ${payload.targetType}. 
Idea: ${payload.ideaText}

Generate exactly 3 to 5 highly relevant questions to refine this idea.
Respond ONLY with a valid JSON array of objects. Each object must have:
- "id": a unique string (e.g. "q1")
- "questionText": the string question
- "questionType": strictly one of "free_text", "single_select", or "multi_select"
- "options": an array of strings (only required if questionType is single_select or multi_select).

Do not include any markdown formatting, just the raw JSON array.`;

  let content = '';

  // 1. Try Gemini if key configured
  if (keys.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = await response.json();
    content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  } 
  // 2. Fallback to Groq if key configured
  else if (keys.groqKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error: ${errText}`);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '[]';
  } 
  // 3. Fallback to OpenAI if key configured
  else if (keys.openAiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error: ${errText}`);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '[]';
  } 
  else {
    throw new Error('No API key found. Please configure your Google Gemini, Groq, or OpenAI API key in Settings.');
  }

  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr) as Question[];
  } catch {
    console.error('Failed to parse JSON', content);
    throw new Error('Invalid JSON received from AI engine.');
  }
};

export const synthesizePrompt = async (
  idea: IdeaPayload,
  answers: Answer[],
  questions: Question[]
): Promise<string> => {
  const keys = getActiveApiKeys();

  const answersText = answers.map(a => {
    const q = questions.find(q => q.id === a.questionId);
    return `Q: ${q?.questionText}\nA: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`;
  }).join('\n\n');

  const prompt = `You are an expert software architect and prompt engineering director. 
A user wants to build a project.

Target Audience / Output Type: ${idea.targetType}
Initial Idea: ${idea.ideaText}

Here are the clarifying questions and their answers:
${answersText}

Based on all of this, write a comprehensive, highly-detailed Project Brief and Implementation Plan. 
Include sections for:
- Executive Summary
- Core System Prompt (ready to copy into Claude / Cursor / Windsurf / ChatGPT)
- Functional Requirements & Architecture
- Edge Cases & Quality Rubric.
Format this entirely in clean GitHub-flavored Markdown.`;

  if (keys.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (keys.groqKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else if (keys.openAiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else {
    throw new Error('No API key configured. Please set your Gemini, Groq, or OpenAI key.');
  }
};

export const refinePrompt = async (currentPrompt: string, followUp: string): Promise<{updatedMarkdown: string, summary: string}> => {
  const keys = getActiveApiKeys();

  const prompt = `You are an expert prompt engineer. You have drafted this markdown document:
${currentPrompt}

The user has provided this follow-up feedback:
"${followUp}"

Please completely rewrite the markdown document incorporating this feedback. 
Respond ONLY with a valid JSON object. Do not include any conversational filler or markdown formatting around the JSON (e.g. no \`\`\`json).
The JSON object must have exactly two keys:
- "updatedMarkdown": The complete updated markdown document as a string.
- "summary": A detailed summary (2-3 sentences) explaining exactly what you added, changed, or removed based on the user's feedback.`;

  let content = '';

  if (keys.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = await response.json();
    content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  } else if (keys.groqKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error: ${errText}`);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '{}';
  } else if (keys.openAiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error: ${errText}`);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '{}';
  } else {
    throw new Error('No API key configured for refinement.');
  }

  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr) as {updatedMarkdown: string, summary: string};
  } catch {
    console.error('Failed to parse JSON', content);
    throw new Error('Invalid JSON received from AI engine.');
  }
};

export const testPrompt = async (modelId: string, systemPrompt: string, userPrompt: string): Promise<string> => {
  const keys = getActiveApiKeys();

  // Hugging Face serverless models
  if (modelId.startsWith('hf/')) {
    if (!keys.huggingFaceKey) {
      throw new Error('Please configure your Hugging Face API key in Settings to test this model.');
    }
    const realModelId = modelId.replace('hf/', '');
    const response = await fetch(`https://api-inference.huggingface.co/models/${realModelId}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.huggingFaceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: realModelId,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hugging Face Error: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // OpenRouter models
  if (modelId.includes('/')) {
    if (!keys.openRouterKey) {
      throw new Error('Please configure your OpenRouter API key in Settings to test community models.');
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter Error: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Google Gemini models
  const isGemini = modelId.toLowerCase().includes('gemini');
  if (isGemini) {
    if (!keys.geminiKey) {
      throw new Error('Please configure your Google Gemini API key in Settings to run this benchmark.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Error: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Groq LLaMA models
  if (!keys.groqKey) {
    throw new Error('Please configure your Groq API key in Settings to test LLaMA models.');
  }

  const groqModel = modelId === 'llama-3-70b' ? 'llama-3.3-70b-versatile' 
    : modelId === 'llama-3-8b' ? 'llama-3.1-8b-instant'
    : 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${keys.groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq Error: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};
