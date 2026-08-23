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

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;

export const generateQuestions = async (payload: IdeaPayload): Promise<Question[]> => {
  const prompt = `You are an expert product manager. The user has an idea for a ${payload.targetType}. 
Idea: ${payload.ideaText}

Generate exactly 3 to 5 highly relevant questions to refine this idea.
Respond ONLY with a valid JSON array of objects. Each object must have:
- "id": a unique string (e.g. "q1")
- "questionText": the string question
- "questionType": strictly one of "free_text", "single_select", or "multi_select"
- "options": an array of strings (only required if questionType is single_select or multi_select).

Do not include any markdown formatting, just the raw JSON array.`;

  const response = await fetch(`/api/gemini/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API Error:', errText);
    throw new Error('Failed to generate questions: ' + errText);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  
  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr) as Question[];
  } catch (e) {
    console.error('Failed to parse JSON', content);
    throw new Error('Invalid JSON from LLM');
  }
};

export const synthesizePrompt = async (
  idea: IdeaPayload,
  answers: Answer[],
  questions: Question[]
): Promise<string> => {
  const answersText = answers.map(a => {
    const q = questions.find(q => q.id === a.questionId);
    return `Q: ${q?.questionText}\nA: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`;
  }).join('\n\n');

  const prompt = `You are an expert software architect and product manager. 
A user wants to build a project.

Target Audience / Output Type: ${idea.targetType}
Initial Idea: ${idea.ideaText}

Here are the clarifying questions and their answers:
${answersText}

Based on all of this, write a comprehensive, highly-detailed Project Brief and Implementation Plan. 
Include sections for:
- Executive Summary
- Core Features
- Technical Architecture Recommendations
- Potential challenges.
Format this entirely in beautiful Markdown.`;

  const response = await fetch(`/api/gemini/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API Error:', errText);
    throw new Error('Failed to synthesize prompt: ' + errText);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const refinePrompt = async (currentPrompt: string, followUp: string): Promise<{updatedMarkdown: string, summary: string}> => {
  const prompt = `You are an expert prompt engineer. You have drafted this markdown document:
${currentPrompt}

The user has provided this follow-up feedback:
"${followUp}"

Please completely rewrite the markdown document incorporating this feedback. 
Respond ONLY with a valid JSON object. Do not include any conversational filler or markdown formatting around the JSON (e.g. no \`\`\`json).
The JSON object must have exactly two keys:
- "updatedMarkdown": The complete updated markdown document as a string.
- "summary": A detailed summary (2-3 sentences) explaining exactly what you added, changed, or removed based on the user's feedback.`;

  const response = await fetch(`/api/gemini/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API Error:', errText);
    throw new Error('Failed to refine prompt: ' + errText);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  
  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr) as {updatedMarkdown: string, summary: string};
  } catch (e) {
    console.error('Failed to parse JSON', content);
    throw new Error('Invalid JSON from LLM');
  }
};

export const testPrompt = async (modelId: string, systemPrompt: string, userPrompt: string): Promise<string> => {
  if (modelId.startsWith('hf/')) {
    const realModelId = modelId.replace('hf/', '');
    const response = await fetch(`/api/huggingface/models/${realModelId}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
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
      throw new Error(`Hugging Face API Error: ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // OpenRouter models typically have a slash, e.g., 'google/gemma-2-9b-it:free'
  if (modelId.includes('/')) {
    const response = await fetch('/api/openrouter/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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
      throw new Error(`OpenRouter API Error: ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  const isGemini = modelId.toLowerCase().includes('gemini');

  if (isGemini) {
    const response = await fetch(`/api/gemini/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Fallback to Groq for everything else (assuming Groq supports it, or mapping to a default groq model)
  // For safety, we will map unknown models to llama-3.1-70b-versatile for the demo
  const groqModel = modelId === 'llama-3-70b' ? 'llama-3.1-70b-versatile' 
    : modelId === 'llama-3-8b' ? 'llama-3.1-8b-instant'
    : 'llama-3.1-70b-versatile';

  const response = await fetch('/api/groq/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
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
    throw new Error(`Groq API Error: ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};
