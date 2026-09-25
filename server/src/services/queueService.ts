interface QueueJob<T> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  enqueuedAt: number;
}

export class QueueService {
  private static MAX_CONCURRENCY = 15; // Max concurrent heavy LLM tasks
  private static activeCount = 0;
  private static queue: QueueJob<any>[] = [];

  /**
   * Enqueues or immediately executes an asynchronous heavy operation
   */
  public static async enqueue<T>(
    id: string,
    task: () => Promise<T>,
    onQueueNotice?: (position: number, estimatedWaitSeconds: number) => void
  ): Promise<T> {
    if (this.activeCount < this.MAX_CONCURRENCY) {
      this.activeCount++;
      try {
        return await task();
      } finally {
        this.activeCount--;
        this.processNext();
      }
    }

    // Heavy load: Queue request gracefully
    const position = this.queue.length + 1;
    const estimatedWaitSeconds = position * 2; // ~2 seconds per turn
    if (onQueueNotice) {
      onQueueNotice(position, estimatedWaitSeconds);
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        task,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      });
    });
  }

  private static processNext(): void {
    if (this.queue.length === 0 || this.activeCount >= this.MAX_CONCURRENCY) {
      return;
    }

    const nextJob = this.queue.shift();
    if (!nextJob) return;

    this.activeCount++;
    nextJob
      .task()
      .then((res) => {
        nextJob.resolve(res);
      })
      .catch((err) => {
        nextJob.reject(err);
      })
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }

  public static getStats() {
    return {
      activeConcurrency: this.activeCount,
      queuedRequests: this.queue.length,
      maxConcurrency: this.MAX_CONCURRENCY,
      isUnderHeavyLoad: this.queue.length > 5,
    };
  }
}
