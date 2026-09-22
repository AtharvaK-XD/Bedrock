import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Replaces generateQuestions in api.ts
router.post('/generate-questions', requireAuth, async (req, res) => {
  const { ideaText, targetType } = req.body;
  if (!ideaText) {
    res.status(400).json({ error: 'Idea text is required' });
    return;
  }

  const prompt = `You are an expert product manager. The user has an idea for a ${targetType}. 
Idea: ${ideaText}

Generate exactly 3 to 5 highly relevant questions to refine this idea.
Respond ONLY with a valid JSON array of objects. Each object must have:
- "id": a unique string (e.g. "q1")
- "questionText": the string question
- "questionType": strictly one of "free_text", "single_select", or "multi_select"
- "options": an array of strings (only required if questionType is single_select or multi_select).

Do not include any markdown formatting, just the raw JSON array.`;

  try {
    let content = '';
    
    if (process.env.GEMINI_API_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      if (!response.ok) {
         throw new Error(await response.text());
      }
      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    } 
    else if (process.env.GROQ_API_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
         throw new Error(await response.text());
      }
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '[]';
    } else {
       res.status(500).json({ error: 'No backend API key configured' });
       return;
    }

    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    res.json(JSON.parse(jsonStr));
  } catch (err) {
    console.error('AI Proxy Error:', err);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// Replaces synthesizePrompt
router.post('/synthesize', requireAuth, async (req, res) => {
  const { idea, answers, questions } = req.body;
  
  const answersText = answers.map((a: any) => {
    const q = questions.find((q: any) => q.id === a.questionId);
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
- Core System Prompt (ready to copy into Claude / Cursor / Windsurf / Gemini)
- Functional Requirements & Architecture
- Edge Cases & Quality Rubric.
Format this entirely in clean GitHub-flavored Markdown.`;

  try {
    let content = '';
    if (process.env.GEMINI_API_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (process.env.GROQ_API_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to synthesize' });
  }
});

// Replaces refinePrompt
router.post('/refine', requireAuth, async (req, res) => {
  const { currentPrompt, followUp } = req.body;
  
  const prompt = `You are an expert prompt engineer. You have drafted this markdown document:
${currentPrompt}

The user has provided this follow-up feedback:
"${followUp}"

Please completely rewrite the markdown document incorporating this feedback. 
Respond ONLY with a valid JSON object. Do not include any conversational filler or markdown formatting around the JSON (e.g. no \`\`\`json).
The JSON object must have exactly two keys:
- "updatedMarkdown": The complete updated markdown document as a string.
- "summary": A detailed summary (2-3 sentences) explaining exactly what you added, changed, or removed based on the user's feedback.`;

  try {
    let content = '';
    if (process.env.GEMINI_API_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5 },
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } else if (process.env.GROQ_API_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '{}';
    }
    
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    res.json(JSON.parse(jsonStr));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to refine' });
  }
});

// Replaces testPrompt
router.post('/test', requireAuth, async (req, res) => {
  const { modelId, systemPrompt, userPrompt } = req.body;
  
  try {
    let content = '';

    // Hugging Face serverless models
    if (modelId.startsWith('hf/')) {
      if (!process.env.HUGGINGFACE_API_KEY) {
        return res.status(400).json({ error: 'Hugging Face API Key not configured on backend.' });
      }
      const realModelId = modelId.replace('hf/', '');
      const response = await fetch(`https://api-inference.huggingface.co/models/${realModelId}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
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
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }
    // OpenRouter models
    else if (modelId.includes('/')) {
      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(400).json({ error: 'OpenRouter API Key not configured on backend.' });
      }
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }
    // Google Gemini models
    else if (modelId.toLowerCase().includes('gemini')) {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ error: 'Gemini API Key not configured on backend.' });
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7 }
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    // Groq models (fallback)
    else {
      if (!process.env.GROQ_API_KEY) {
        return res.status(400).json({ error: 'Groq API Key not configured on backend.' });
      }
      const groqModel = modelId === 'llama-3-70b' ? 'llama-3.3-70b-versatile' 
        : modelId === 'llama-3-8b' ? 'llama-3.1-8b-instant'
        : 'llama-3.3-70b-versatile';
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }

    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to test prompt' });
  }
});

export default router;
