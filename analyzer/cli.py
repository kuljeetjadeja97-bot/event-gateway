from __future__ import annotations

import argparse
import json
from pathlib import Path

from stats import Sample, bottlenecks, slowest_routes, summarize


def load_samples(path: Path) -> list[Sample]:
    samples: list[Sample] = []
    with path.open() as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            samples.append(
                Sample(route=raw["route"], latency_ms=float(raw["latency_ms"]), status=int(raw["status"]))
            )
    return samples


def main() -> None:
    parser = argparse.ArgumentParser(description="Find slow routes from JSONL access samples")
    parser.add_argument("file", type=Path)
    parser.add_argument("--budget-ms", type=float, default=200.0)
    args = parser.parse_args()

    summary = summarize(load_samples(args.file))
    report = {
        "slowest": [{"route": route, "p95": p95} for route, p95 in slowest_routes(summary)],
        "bottlenecks": bottlenecks(summary, args.budget_ms),
        "routes": summary,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
