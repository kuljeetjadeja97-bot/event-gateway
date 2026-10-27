# Contributing

## Review checklist

- Ingest handlers must stay O(1) on the success path. Do not scan the event log to detect duplicates; that is what the idempotency key + LRU is for.
- Rate limits are per tenant (`x-tenant-id`), not global. A noisy tenant should not stall others.
- JSON body size is capped. Raising the limit needs a payload-size test and a note on memory.
- Python analyzer changes should keep `slowest_routes` at O(n log k). Sorting the full map is fine in tests, not in the hot helper.
- When a test fails only under parallel `node --test`, look for shared listen ports or leaked servers — `listen(0)` is required.

## Debugging latency

1. Hit `/v1/metrics` on the API for in-process p50/p95/p99.
2. Dump JSONL (`route`, `latency_ms`, `status`) and run `python cli.py fixtures/access.jsonl`.
3. Routes over the p95 budget or with >1% 5xx are bottlenecks; fix those before adding hardware.
