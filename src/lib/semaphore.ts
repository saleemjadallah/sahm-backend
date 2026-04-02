export class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(limit: number) {
    this.available = Math.max(1, limit);
  }

  async use<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire() {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.available -= 1;
        resolve();
      });
    });
  }

  private release() {
    this.available += 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
