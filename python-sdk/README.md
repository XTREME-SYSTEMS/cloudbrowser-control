# Cloud Browser Python SDK

A Python client for the Cloud Browser automation platform — manage headless Chrome sessions, jobs, proxies, and data extraction.

## Installation

```bash
pip install cloudbrowser-sdk
```

## Quick Start

```python
from cloudbrowser import CloudBrowser

# Initialize with your API key (from Dashboard > Settings > API Keys)
client = CloudBrowser(api_key="cb_live_xxx")

# Create a session
session = client.sessions.create(
    url="https://example.com",
    viewport={"width": 1920, "height": 1080},
    proxy_id="proxy-123"  # optional
)

# Create a job with steps
job = client.jobs.create(
    name="Extract Products",
    start_url="https://example.com/products",
    priority=1,  # 1 = highest, 10 = lowest
)

# Add steps
client.steps.create(job_id=job["id"], action_type="goto", order=0, value="https://example.com/products")
client.steps.create(job_id=job["id"], action_type="extract_table", order=1,
                    selector=".product-grid",
                    output_schema={"type": "object", "properties": {"name": {"type": "string"}, "price": {"type": "string"}}})

# Run the job
client.jobs.run(job["id"])

# Check status
job = client.jobs.get(job["id"])
print(f"Status: {job['status']}")
```

## Proxy Management

```python
# Create a residential proxy with geo-targeting
proxy = client.proxies.create(
    name="NYC Residential",
    server="gate.brightdata.com:22225",
    protocol="http",
    ip_type="residential",
    provider="bright_data",
    country="us",
    city="new york",
    state="ny",
    asn="AS12345",
    zip_code="10001",
)

# Test proxy connectivity
result = client.proxies.test(proxy["id"])
```

## Job Priority Queue

```python
# High-priority job (processed first)
high_priority = client.jobs.create(name="Urgent Extract", start_url="https://example.com", priority=1)

# Low-priority job (processed last)
low_priority = client.jobs.create(name="Background Crawl", start_url="https://example.com", priority=10)
```

## Shadow Mode (Safe Testing)

```python
# Run in read-only mode to capture site defenses before going live
job = client.jobs.create(
    name="Shadow Test",
    start_url="https://example.com",
    shadow_mode=True,
)
client.jobs.run(job["id"])
# Check shadow_report for detected anti-bot systems
```

## API Reference

| Resource | Methods |
|----------|---------|
| `client.sessions` | `create()`, `get()`, `list()`, `update()`, `delete()`, `screenshot()`, `extract()` |
| `client.jobs` | `create()`, `get()`, `list()`, `update()`, `delete()`, `run()`, `cancel()`, `retry()` |
| `client.steps` | `create()`, `get()`, `list()`, `update()`, `delete()` |
| `client.projects` | `create()`, `get()`, `list()`, `update()`, `delete()` |
| `client.proxies` | `create()`, `get()`, `list()`, `update()`, `delete()`, `test()` |
| `client.profiles` | `create()`, `get()`, `list()`, `update()`, `delete()` |
| `client.health()` | Check engine health |
| `client.metrics()` | Get platform metrics |

## License

MIT