import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: any;
}

const basePrisma =
  global.__prismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Section 13: Database Scaling & Resilience
// Add explicit 5000ms query timeout to prevent hanging connections under launch traffic
export const prisma: PrismaClient = (basePrisma.$extends({
  query: {
    async $allOperations({ operation, model, args, query }: any) {
      const timeoutMs = 5000;
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`[DatabaseTimeout] Query ${model}.${operation} exceeded ${timeoutMs}ms limit.`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([query(args), timeoutPromise]);
        clearTimeout(timer!);
        return result;
      } catch (err) {
        clearTimeout(timer!);
        throw err;
      }
    },
  },
}) as any);

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = basePrisma;
}

export const DEFAULT_USER_ID = 'default-local-user';

export async function initDb(): Promise<void> {
  try {
    await (prisma as any).$connect();
    console.log('[Database] Connected to database with query timeout & pooling enabled.');

    // Ensure default local user exists for local desktop usage
    const defaultUser = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID },
    });

    if (!defaultUser) {
      const defaultHash = await argon2.hash('bedrock_local_dev_secret_key');
      await prisma.user.create({
        data: {
          id: DEFAULT_USER_ID,
          email: 'local-user@bedrock.app',
          password_hash: defaultHash,
          name: 'Atharva K.',
          username: 'atharvak',
          role: 'Lead Prompt Architect',
          bio: 'Architecting multi-model agentic pipelines and system prompt evaluation trees on Bedrock.',
          plan: 'Free Plan',
          location: 'San Francisco, CA (UTC-7)',
          organization: 'Bedrock Labs',
          avatar_initials: 'AK',
          github: 'atharva-k',
          huggingface: 'atharvak',
          website: 'https://bedrock.ai',
          joined_date: 'January 2025',
          email_verified: true,
          mfa_enabled: true,
        },
      });
      console.log('[Database] Initialized default local user profile.');
    }
  } catch (error) {
    console.error('[Database] Failed to connect to database:', error);
  }
}

export async function logSecurityEvent(params: {
  userId?: string;
  eventType: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
  ipAddress?: string;
  endpoint?: string;
  message: string;
}): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        user_id: params.userId,
        event_type: params.eventType,
        severity: params.severity || 'INFO',
        ip_address: params.ipAddress,
        endpoint: params.endpoint,
        message: params.message,
      },
    });
  } catch (err) {
    console.error('[SecurityAudit] Failed to record security event:', err);
  }
}
