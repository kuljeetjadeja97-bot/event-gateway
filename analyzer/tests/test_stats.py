from stats import Sample, bottlenecks, percentile, slowest_routes, summarize


def test_percentile_interpolates() -> None:
    assert percentile([1.0, 2.0, 3.0, 4.0], 50) == 2.5
    assert percentile([10.0], 99) == 10.0


def test_slowest_routes_uses_p95() -> None:
    samples = [
        Sample("fast", 10, 200),
        Sample("fast", 12, 200),
        Sample("slow", 400, 200),
        Sample("slow", 420, 200),
        Sample("mid", 80, 200),
        Sample("mid", 90, 200),
    ]
    top = slowest_routes(summarize(samples), k=2)
    assert [route for route, _ in top] == ["slow", "mid"]


def test_bottlenecks_flag_errors_and_latency() -> None:
    samples = [
        Sample("ok", 20, 200),
        Sample("ok", 21, 200),
        Sample("errors", 30, 500),
        Sample("errors", 31, 200),
        Sample("errors", 32, 200),
        Sample("errors", 33, 200),
        Sample("errors", 34, 200),
        Sample("hot", 500, 200),
        Sample("hot", 510, 200),
    ]
    flagged = bottlenecks(summarize(samples), p95_budget_ms=200)
    assert "hot" in flagged
    assert "errors" in flagged
    assert "ok" not in flagged
