export class PacedQueue {
  private readonly intervalMs: number;
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly lastRun = new Map<string, number>();
  private readonly depth = new Map<string, number>();

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    this.depth.set(key, (this.depth.get(key) ?? 0) + 1);
    const previous = this.tails.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const wait = (this.lastRun.get(key) ?? 0) + this.intervalMs - Date.now();
        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        try {
          return await task();
        } finally {
          this.lastRun.set(key, Date.now());
          this.depth.set(key, (this.depth.get(key) ?? 1) - 1);
        }
      });
    this.tails.set(key, next);
    return next;
  }

  pending(key: string): number {
    return this.depth.get(key) ?? 0;
  }

  async idle(): Promise<void> {
    await Promise.allSettled([...this.tails.values()]);
  }
}
