import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { KeyedTokenBuckets } from "./tokenBucket.js";
import { LruCache } from "./lruCache.js";
import { EventStore, type IngestedEvent } from "./store.js";

type CreateAppOptions = {
  buckets?: KeyedTokenBuckets;
  store?: EventStore;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const store = options.store ?? new EventStore();
  const buckets = options.buckets ?? new KeyedTokenBuckets(30, 10);
  const recent = new LruCache<IngestedEvent>(5_000);
  const latencies: number[] = [];

  app.use(express.json({ limit: "32kb" }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      latencies.push(elapsedMs);
      if (latencies.length > 2_000) {
        latencies.splice(0, latencies.length - 2_000);
      }
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", events: store.count() });
  });

  app.get("/v1/metrics", (_req, res) => {
    const sorted = [...latencies].sort((a, b) => a - b);
    const pct = (p: number) => {
      if (sorted.length === 0) {
        return 0;
      }
      const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
      return Number(sorted[idx].toFixed(3));
    };
    res.json({
      count: sorted.length,
      p50: pct(50),
      p95: pct(95),
      p99: pct(99)
    });
  });

  app.post("/v1/events", (req, res) => {
    const tenant = String(req.header("x-tenant-id") ?? "anonymous");
    if (!buckets.allow(tenant)) {
      res.status(429).json({ title: "Too Many Requests", detail: "Token bucket empty for tenant" });
      return;
    }

    const type = req.body?.type;
    if (typeof type !== "string" || type.length === 0) {
      res.status(400).json({ title: "Bad Request", detail: "type is required" });
      return;
    }

    const idempotencyKey = req.header("idempotency-key") ?? undefined;
    if (idempotencyKey) {
      const cached = recent.get(idempotencyKey);
      if (cached) {
        res.status(200).json(cached);
        return;
      }
    }

    const event: IngestedEvent = {
      id: randomUUID(),
      type,
      payload: req.body?.payload ?? {},
      receivedAt: new Date().toISOString(),
      idempotencyKey
    };
    const stored = store.put(event);
    if (idempotencyKey) {
      recent.set(idempotencyKey, stored);
    }
    res.status(stored.id === event.id ? 201 : 200).json(stored);
  });

  app.get("/v1/events/:id", (req, res) => {
    const event = store.get(req.params.id);
    if (!event) {
      res.status(404).json({ title: "Not Found", detail: `event ${req.params.id} missing` });
      return;
    }
    res.json(event);
  });

  return app;
}
