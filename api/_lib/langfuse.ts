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
 * Records an LLM generation trace to Langfuse without interrupting execution.
 * Only model, timing, status, user id and numeric metadata are sent: prompts and outputs
 * stay on our servers, so there are deliberately no input/output fields here.
 */
export async function recordLangfuseGeneration(params: {
  traceName: string;
  model: string;
  userId?: string;
  metadata?: Record<string, string | number | boolean>;
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
    });

    const generation = trace.generation({
      name: params.traceName,
      model: params.model,
      metadata: params.metadata,
      startTime: params.startTime || new Date(),
      endTime: params.endTime || new Date(),
      level: params.level || 'DEFAULT',
      statusMessage: params.statusMessage,
    });

    generation.end();

    await langfuse.flushAsync();
  } catch (err) {
    console.warn('[Langfuse] Non-blocking telemetry warning:', err);
  }
}
