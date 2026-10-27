import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import { KeyedTokenBuckets } from "../src/tokenBucket.ts";

function listen(app: ReturnType<typeof createApp>): Promise<{ base: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("expected tcp address");
      }
      resolve({
        base: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done())))
      });
    });
  });
}

describe("event ingest API", () => {
  it("creates then fetches an event", async () => {
    const { base, close } = await listen(createApp());
    try {
      const created = await fetch(`${base}/v1/events`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "k1" },
        body: JSON.stringify({ type: "order.created", payload: { orderId: "o-1" } })
      });
      assert.equal(created.status, 201);
      const body = (await created.json()) as { id: string; type: string };
      const fetched = await fetch(`${base}/v1/events/${body.id}`);
      assert.equal(fetched.status, 200);
      const roundTrip = (await fetched.json()) as { type: string };
      assert.equal(roundTrip.type, "order.created");
    } finally {
      await close();
    }
  });

  it("replays idempotent posts", async () => {
    const { base, close } = await listen(createApp());
    try {
      const headers = { "content-type": "application/json", "idempotency-key": "same" };
      const body = JSON.stringify({ type: "ping" });
      const first = await fetch(`${base}/v1/events`, { method: "POST", headers, body });
      const second = await fetch(`${base}/v1/events`, { method: "POST", headers, body });
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      const a = (await first.json()) as { id: string };
      const b = (await second.json()) as { id: string };
      assert.equal(a.id, b.id);
    } finally {
      await close();
    }
  });

  it("rate limits a noisy tenant", async () => {
    const { base, close } = await listen(createApp({ buckets: new KeyedTokenBuckets(2, 0.0001) }));
    try {
      const headers = { "content-type": "application/json", "x-tenant-id": "burst" };
      const one = await fetch(`${base}/v1/events`, { method: "POST", headers, body: JSON.stringify({ type: "a" }) });
      const two = await fetch(`${base}/v1/events`, { method: "POST", headers, body: JSON.stringify({ type: "b" }) });
      const three = await fetch(`${base}/v1/events`, { method: "POST", headers, body: JSON.stringify({ type: "c" }) });
      assert.equal(one.status, 201);
      assert.equal(two.status, 201);
      assert.equal(three.status, 429);
    } finally {
      await close();
    }
  });
});
