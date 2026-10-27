import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LruCache } from "../src/lruCache.ts";

describe("LruCache", () => {
  it("evicts the least recently used key", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    assert.equal(cache.get("b"), undefined);
    assert.equal(cache.get("a"), 1);
    assert.equal(cache.get("c"), 3);
  });
});
