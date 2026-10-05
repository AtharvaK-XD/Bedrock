import { Langfuse } from 'langfuse';

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
const baseUrl = process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_BASEURL || 'https://us.cloud.langfuse.com';

export const langfuse = (publicKey && secretKey)
  ? new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
    })
  : null;

/**
 * Records an LLM generation trace to Langfuse without interrupting execution
 */
export async function recordLangfuseGeneration(params: {
  traceName: string;
  model: string;
  input: any;
  output: any;
  userId?: string;
  metadata?: Record<string, any>;
  startTime?: Date;
  endTime?: Date;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
}): Promise<void> {
  if (!langfuse) return;
  try {
    const trace = langfuse.trace({
      name: params.traceName,
      userId: params.userId,
      metadata: params.metadata,
      input: params.input,
      output: params.output,
    });

    const generation = trace.generation({
      name: params.traceName,
      model: params.model,
      input: params.input,
      output: params.output,
      startTime: params.startTime || new Date(),
      endTime: params.endTime || new Date(),
      level: params.level || 'DEFAULT',
      statusMessage: params.statusMessage,
    });

    generation.end({
      output: params.output,
      endTime: params.endTime || new Date(),
    });

    await langfuse.flushAsync();
  } catch (err) {
    console.warn('[Langfuse] Non-blocking telemetry warning:', err);
  }
}
