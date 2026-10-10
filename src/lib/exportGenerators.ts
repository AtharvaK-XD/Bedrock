export type ExportCategory = 'ide' | 'sdk' | 'api';

export interface ExportTarget {
  id: string;
  name: string;
  category: ExportCategory;
  extension: string;
  filename: string;
  language: 'markdown' | 'typescript' | 'python' | 'json' | 'bash';
  description: string;
  badge: string;
  generate: (prompt: string, title?: string, model?: string) => string;
}

export function extractPromptVariables(prompt: string): string[] {
  if (!prompt) return [];
  const matches = Array.from(prompt.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g));
  return Array.from(new Set(matches.map((m) => m[1])));
}

export const EXPORT_MODELS = [
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq' },
];

export const EXPORT_TARGETS: ExportTarget[] = [
  // ==================== IDE & AGENT RULES ====================
  {
    id: 'cursorrules',
    name: 'Cursor Rules',
    category: 'ide',
    extension: '.cursorrules',
    filename: '.cursorrules',
    language: 'markdown',
    badge: 'Cursor IDE',
    description: 'System rules and boundaries for Cursor IDE assistant and composer.',
    generate: (prompt, title) => `# ${title || 'Bedrock Agent Instructions'}
# Generated via Bedrock Prompt Engineering Workstation

You are an expert AI development partner. Adhere strictly to the operational instructions and architectural constraints below:

<system_instructions>
${prompt.trim()}
</system_instructions>

## Operational Constraints
- Follow all directives, formatting boundaries, and persona constraints defined in <system_instructions>.
- Provide direct, concise, and production-grade code. Avoid unnecessary conversational preamble.
- Respect all security, parameter validation, and architecture guardrails.
`,
  },
  {
    id: 'claudemd',
    name: 'Claude Code CLI',
    category: 'ide',
    extension: '.md',
    filename: 'CLAUDE.md',
    language: 'markdown',
    badge: 'Claude Code',
    description: 'Project memory and instructions file for Anthropic Claude Code CLI.',
    generate: (prompt, title) => `# Project Guidelines: ${title || 'Bedrock Agent'}

> Configured for Anthropic Claude Code CLI (\`claude\`) in the project root.

## System Instructions & Primary Role
${prompt.trim()}

## Standard Commands
- Build: \`npm run build\`
- Dev Server: \`npm run dev\`
- Linting: \`npm run lint\`
- Typecheck: \`npx tsc --noEmit\`

## Code Quality Standards
- Write clean, modular, and strictly-typed implementations.
- Always include explicit error handling at system and API boundaries.
- Minimize diffs to touched areas; preserve existing comments and documentation.
`,
  },
  {
    id: 'windsurf',
    name: 'Windsurf Rules',
    category: 'ide',
    extension: '.windsurfrules',
    filename: '.windsurfrules',
    language: 'markdown',
    badge: 'Windsurf Cascade',
    description: 'Workspace rule specifications for Codeium Windsurf Cascade agent.',
    generate: (prompt, title) => `# Windsurf Cascade Rules: ${title || 'Bedrock Architecture'}

<role_and_instructions>
${prompt.trim()}
</role_and_instructions>

<rules>
1. Always analyze workspace structure and dependency trees before modifying files.
2. Adhere strictly to the instructions defined in <role_and_instructions>.
3. Prefer minimal, surgical code diffs. Never delete existing functionality unless requested.
4. Verify strict types before concluding multi-file edits.
</rules>
`,
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    category: 'ide',
    extension: '.md',
    filename: 'copilot-instructions.md',
    language: 'markdown',
    badge: 'Copilot',
    description: 'Workspace-level instructions for GitHub Copilot in .github/copilot-instructions.md.',
    generate: (prompt, title) => `# GitHub Copilot Instructions: ${title || 'Bedrock'}

## System Persona & Directives
${prompt.trim()}

## Implementation Rules
- Ensure all newly authored functions include strict parameter and return types.
- Validate inputs and handle edge cases gracefully.
- Follow established project architecture conventions.
`,
  },

  // ==================== MODERN AI SDKS ====================
  {
    id: 'vercel-ai',
    name: 'Vercel AI SDK',
    category: 'sdk',
    extension: '.ts',
    filename: 'route.ts',
    language: 'typescript',
    badge: 'TypeScript',
    description: 'Ready-to-run streaming endpoint with streamText() for Next.js and Node.js.',
    generate: (prompt, _title, model = 'gpt-4o') => {
      const isClaude = model.includes('claude');
      const isGemini = model.includes('gemini');
      const providerImport = isClaude
        ? "import { anthropic } from '@ai-sdk/anthropic';"
        : isGemini
        ? "import { google } from '@ai-sdk/google';"
        : "import { openai } from '@ai-sdk/openai';";

      const modelCall = isClaude
        ? `anthropic('${model}')`
        : isGemini
        ? `google('${model}')`
        : `openai('${model}')`;

      return `import { streamText } from 'ai';
${providerImport}

export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = streamText({
    model: ${modelCall},
    system: ${JSON.stringify(prompt.trim(), null, 2)},
    prompt: prompt || 'Hello',
  });

  return result.toDataStreamResponse();
}
`;
    },
  },
  {
    id: 'openai-py',
    name: 'OpenAI SDK (Python)',
    category: 'sdk',
    extension: '.py',
    filename: 'openai_agent.py',
    language: 'python',
    badge: 'Python 3',
    description: 'Official Python OpenAI client with system prompt and chat completions.',
    generate: (prompt, _title, model = 'gpt-4o') => `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

SYSTEM_PROMPT = """${prompt.trim().replace(/"""/g, '\\"\\"\\"')}"""

def generate_completion(user_input: str) -> str:
    response = client.chat.completions.create(
        model="${model}",
        temperature=0.7,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input},
        ],
    )
    return response.choices[0].message.content or ""

if __name__ == "__main__":
    result = generate_completion("Provide your initial analysis.")
    print(result)
`,
  },
  {
    id: 'openai-ts',
    name: 'OpenAI SDK (TypeScript)',
    category: 'sdk',
    extension: '.ts',
    filename: 'openai-agent.ts',
    language: 'typescript',
    badge: 'TypeScript',
    description: 'Typed Node.js OpenAI client with completions handler.',
    generate: (prompt, _title, model = 'gpt-4o') => `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = ${JSON.stringify(prompt.trim(), null, 2)};

export async function askAgent(userInput: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: '${model}',
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userInput },
    ],
  });

  return completion.choices[0]?.message?.content || '';
}
`,
  },
  {
    id: 'anthropic-py',
    name: 'Anthropic SDK (Python)',
    category: 'sdk',
    extension: '.py',
    filename: 'claude_agent.py',
    language: 'python',
    badge: 'Python 3',
    description: 'Official Anthropic Claude Python client with top-level system parameter.',
    generate: (prompt, _title, model = 'claude-3-7-sonnet-20250219') => `import os
import anthropic

client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
)

SYSTEM_PROMPT = """${prompt.trim().replace(/"""/g, '\\"\\"\\"')}"""

def ask_claude(user_input: str) -> str:
    message = client.messages.create(
        model="${model}",
        max_tokens=4096,
        temperature=0.7,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_input}
        ]
    )
    return message.content[0].text

if __name__ == "__main__":
    output = ask_claude("Run initial prompt synthesis verification.")
    print(output)
`,
  },
  {
    id: 'anthropic-ts',
    name: 'Anthropic SDK (TypeScript)',
    category: 'sdk',
    extension: '.ts',
    filename: 'claude-agent.ts',
    language: 'typescript',
    badge: 'TypeScript',
    description: 'Typed @anthropic-ai/sdk client with top-level system parameter.',
    generate: (prompt, _title, model = 'claude-3-7-sonnet-20250219') => `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = ${JSON.stringify(prompt.trim(), null, 2)};

export async function askClaude(userInput: string): Promise<string> {
  const message = await client.messages.create({
    model: '${model}',
    max_tokens: 4096,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userInput },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}
`,
  },
  {
    id: 'gemini-py',
    name: 'Google Gen AI (Python)',
    category: 'sdk',
    extension: '.py',
    filename: 'gemini_agent.py',
    language: 'python',
    badge: 'Python 3',
    description: 'Modern google-genai SDK with GenerateContentConfig system instruction.',
    generate: (prompt, _title, model = 'gemini-2.5-flash') => `import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

SYSTEM_PROMPT = """${prompt.trim().replace(/"""/g, '\\"\\"\\"')}"""

def ask_gemini(user_input: str) -> str:
    response = client.models.generate_content(
        model="${model}",
        contents=user_input,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        ),
    )
    return response.text or ""

if __name__ == "__main__":
    print(ask_gemini("Initiate prompt execution."))
`,
  },
  {
    id: 'gemini-ts',
    name: 'Google Gen AI (TypeScript)',
    category: 'sdk',
    extension: '.ts',
    filename: 'gemini-agent.ts',
    language: 'typescript',
    badge: 'TypeScript',
    description: 'Modern @google/genai SDK with systemInstruction config.',
    generate: (prompt, _title, model = 'gemini-2.5-flash') => `import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = ${JSON.stringify(prompt.trim(), null, 2)};

export async function askGemini(userInput: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: '${model}',
    contents: userInput,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
    },
  });

  return response.text || '';
}
`,
  },
  {
    id: 'langchain-py',
    name: 'LangChain (Python)',
    category: 'sdk',
    extension: '.py',
    filename: 'langchain_chain.py',
    language: 'python',
    badge: 'LangChain',
    description: 'Runnable LCEL chain using ChatPromptTemplate and ChatOpenAI.',
    generate: (prompt, _title, model = 'gpt-4o') => `from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

system_template = """${prompt.trim().replace(/"""/g, '\\"\\"\\"')}"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", system_template),
    ("human", "{user_input}")
])

model = ChatOpenAI(model="${model}", temperature=0.7)
chain = prompt_template | model

def run_agent(user_input: str) -> str:
    result = chain.invoke({"user_input": user_input})
    return str(result.content)

if __name__ == "__main__":
    print(run_agent("Test agent prompt."))
`,
  },

  // ==================== API & PAYLOADS ====================
  {
    id: 'curl',
    name: 'cURL Command',
    category: 'api',
    extension: '.sh',
    filename: 'curl-request.sh',
    language: 'bash',
    badge: 'HTTP / Bash',
    description: 'Direct cURL HTTP POST command with JSON payload.',
    generate: (prompt, _title, model = 'gpt-4o') => `curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '{
    "model": "${model}",
    "temperature": 0.7,
    "messages": [
      {
        "role": "system",
        "content": ${JSON.stringify(prompt.trim())}
      },
      {
        "role": "user",
        "content": "Execute prompt task."
      }
    ]
  }'
`,
  },
  {
    id: 'json',
    name: 'Raw JSON Payload',
    category: 'api',
    extension: '.json',
    filename: 'payload.json',
    language: 'json',
    badge: 'JSON',
    description: 'Standard OpenAI-compatible JSON messages payload.',
    generate: (prompt, _title, model = 'gpt-4o') => JSON.stringify(
      {
        model: model,
        temperature: 0.7,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: prompt.trim(),
          },
          {
            role: 'user',
            content: 'User query or variable target here.',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'markdown',
    name: 'Raw Markdown (.md)',
    category: 'api',
    extension: '.md',
    filename: 'system-prompt.md',
    language: 'markdown',
    badge: 'Markdown',
    description: 'Formatted markdown file with frontmatter metadata.',
    generate: (prompt, title) => `---
title: ${title || 'Bedrock System Prompt'}
generator: Bedrock Prompt Engineering Workstation
created: ${new Date().toISOString().split('T')[0]}
---

${prompt.trim()}
`,
  },
];
