export class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly max = 10_000) {
    if (max <= 0) {
      throw new Error("max must be positive");
    }
  }

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  size(): number {
    return this.map.size;
  }
}
