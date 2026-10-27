# event-gateway

Two services that together model an ingest edge:

- **api** — Node.js 22 / TypeScript HTTP gateway. Accepts events, enforces a per-tenant token bucket, and de-duplicates retries with an idempotency key plus an LRU.
- **analyzer** — Python 3.11 CLI that turns JSONL access logs into p50/p95/p99 and a top-k bottleneck list (min-heap, O(n log k)).

The in-memory store is intentional. Persistence is a repository swap; the interesting bugs live in retries, backpressure, and tail latency.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/events` | `Idempotency-Key`, `x-tenant-id` |
| `GET` | `/v1/events/{id}` | |
| `GET` | `/v1/metrics` | Rolling latency percentiles |
| `GET` | `/health` | |

```bash
curl -s -X POST http://127.0.0.1:3000/v1/events \
  -H "content-type: application/json" \
  -H "idempotency-key: 9f3c" \
  -H "x-tenant-id: acme" \
  -d '{"type":"order.created","payload":{"orderId":"o-1"}}'
```

A second post with the same key returns `200` and the original event id.

## Run tests

```bash
cd api
npm install
npm test
npm run build

cd ../analyzer
pip install -r requirements.txt
pytest -q
python cli.py fixtures/access.jsonl
```

```bash
docker compose up --build
```

## Performance

Token buckets refill continuously so burst traffic is admitted up to `capacity`, then rejected with `429` instead of queueing unbounded work. `/v1/metrics` is a ring buffer of the last 2k requests so the handler does not allocate a full histogram on every call.
