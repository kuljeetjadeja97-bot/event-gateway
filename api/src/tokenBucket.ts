export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: () => number = Date.now
  ) {
    if (capacity <= 0 || refillPerSecond <= 0) {
      throw new Error("capacity and refillPerSecond must be positive");
    }
    this.tokens = capacity;
    this.lastRefill = now();
    this.now = now;
  }

  private readonly now: () => number;

  tryRemove(count = 1): boolean {
    this.refill();
    if (this.tokens < count) {
      return false;
    }
    this.tokens -= count;
    return true;
  }

  remaining(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const ts = this.now();
    const elapsedSeconds = (ts - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = ts;
  }
}

export class KeyedTokenBuckets {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number
  ) {}

  allow(key: string): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerSecond);
      this.buckets.set(key, bucket);
    }
    return bucket.tryRemove(1);
  }
}
