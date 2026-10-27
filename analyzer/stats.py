from __future__ import annotations

import heapq
from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Sample:
    route: str
    latency_ms: float
    status: int


def percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        raise ValueError("cannot compute percentile of empty series")
    if not 0 <= p <= 100:
        raise ValueError("percentile must be in [0, 100]")
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (p / 100) * (len(sorted_values) - 1)
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    weight = rank - low
    return sorted_values[low] * (1 - weight) + sorted_values[high] * weight


def summarize(samples: list[Sample]) -> dict[str, dict[str, float]]:
    grouped: dict[str, list[float]] = defaultdict(list)
    for sample in samples:
        grouped[sample.route].append(sample.latency_ms)

    summary: dict[str, dict[str, float]] = {}
    for route, values in grouped.items():
        values.sort()
        errors = sum(1 for sample in samples if sample.route == route and sample.status >= 500)
        summary[route] = {
            "count": float(len(values)),
            "p50": percentile(values, 50),
            "p95": percentile(values, 95),
            "p99": percentile(values, 99),
            "error_rate": errors / len(values),
        }
    return summary


def slowest_routes(summary: dict[str, dict[str, float]], k: int = 3) -> list[tuple[str, float]]:
    """Top-k by p95 using a min-heap so the pass stays O(n log k)."""
    heap: list[tuple[float, str]] = []
    for route, stats in summary.items():
        p95 = stats["p95"]
        if len(heap) < k:
            heapq.heappush(heap, (p95, route))
        elif p95 > heap[0][0]:
            heapq.heapreplace(heap, (p95, route))
    return [(route, p95) for p95, route in sorted(heap, reverse=True)]


def bottlenecks(summary: dict[str, dict[str, float]], p95_budget_ms: float = 200.0) -> list[str]:
    flagged = []
    for route, stats in summary.items():
        if stats["p95"] > p95_budget_ms or stats["error_rate"] > 0.01:
            flagged.append(route)
    return sorted(flagged)
