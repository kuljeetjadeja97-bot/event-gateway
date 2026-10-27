import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TokenBucket } from "../src/tokenBucket.ts";

describe("TokenBucket", () => {
  it("rejects once empty and refills over time", () => {
    let now = 0;
    const bucket = new TokenBucket(2, 1, () => now);

    assert.equal(bucket.tryRemove(), true);
    assert.equal(bucket.tryRemove(), true);
    assert.equal(bucket.tryRemove(), false);

    now += 1000;
    assert.equal(bucket.tryRemove(), true);
  });

  it("never exceeds capacity after a long idle period", () => {
    let now = 0;
    const bucket = new TokenBucket(3, 10, () => now);
    now += 60_000;
    assert.equal(bucket.remaining(), 3);
  });
});
