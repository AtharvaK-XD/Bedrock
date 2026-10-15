import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAG_SCRIPT_PATH = path.resolve(__dirname, '../../rag/fact_retriever.py');

export interface GroundedFactsResult {
  groundedFactsBlock: string;
  matchedEntities: string[];
  tokenEstimate: number;
  targetType: string;
  factsCount: number;
}

export class RagService {
  private static memoryCache = new Map<string, GroundedFactsResult>();

  /**
   * Retrieves verified facts via Python RAG engine with fast in-memory caching
   */
  public static async getGroundedFacts(
    query: string,
    targetType = 'coding_agent'
  ): Promise<GroundedFactsResult> {
    const cacheKey = `${targetType}:${query.trim().toLowerCase()}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    return new Promise((resolve) => {
      execFile(
        'python',
        [RAG_SCRIPT_PATH, '--query', query, '--target', targetType, '--json'],
        { timeout: 4000 },
        (error, stdout) => {
          if (error || !stdout) {
            console.warn('[RagService] Fast Python RAG fallback used:', error?.message);
            resolve({
              groundedFactsBlock: '',
              matchedEntities: [],
              tokenEstimate: 0,
              targetType,
              factsCount: 0,
            });
            return;
          }

          try {
            const parsed: GroundedFactsResult = JSON.parse(stdout.trim());
            this.memoryCache.set(cacheKey, parsed);
            resolve(parsed);
          } catch (parseErr) {
            console.warn('[RagService] Failed to parse RAG JSON output:', parseErr);
            resolve({
              groundedFactsBlock: '',
              matchedEntities: [],
              tokenEstimate: 0,
              targetType,
              factsCount: 0,
            });
          }
        }
      );
    });
  }
}
