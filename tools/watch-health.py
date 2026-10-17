#!/usr/bin/env python3
"""Read-only HTTP health observations; write one JSON record per round."""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import time
import urllib.error
import urllib.request

DEFAULT_URLS = (
    'https://freifick.net/',
    'https://freifick.net/api/visits',
    'https://freifick.net/api/pot',
    'https://freifick.net/api/guestbook',
    'https://fedi.freifick.net/nodeinfo/2.0',
    'https://github.com/slopinger',
)


def check(url):
    start = time.monotonic()
    result = {'url': url}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'slop-health-watch/1.0'})
        with urllib.request.urlopen(request, timeout=10) as response:
            result['status'] = response.status
            # Read a bounded amount to detect interrupted responses too.
            response.read(65536)
            result['ok'] = 200 <= response.status < 300
    except (OSError, urllib.error.URLError) as error:
        result.update(ok=False, error=str(error))
    result['seconds'] = round(time.monotonic() - start, 3)
    return result


def positive(value):
    value = float(value)
    if not math.isfinite(value) or value <= 0:
        raise argparse.ArgumentTypeError('must be greater than zero')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--duration', type=positive, default=3600, help='observation duration in seconds')
    parser.add_argument('--interval', type=positive, default=60, help='seconds between rounds')
    parser.add_argument('--output', type=Path, required=True, help='append JSONL observations here')
    parser.add_argument('urls', nargs='*', help='URLs to check (defaults to the slop services)')
    args = parser.parse_args()
    deadline = time.monotonic() + args.duration
    failures = rounds = 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('a') as output:
        while True:
            started = time.monotonic()
            results = [check(url) for url in args.urls or DEFAULT_URLS]
            record = {'time': datetime.now(timezone.utc).isoformat(), 'checks': results}
            output.write(json.dumps(record) + '\n')
            output.flush()
            rounds += 1
            failed = [result for result in results if not result['ok']]
            failures += len(failed)
            print(f"{record['time']}: {len(results)-len(failed)}/{len(results)} healthy", flush=True)
            for result in failed:
                print(json.dumps(result), flush=True)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(remaining, max(0, args.interval - (time.monotonic() - started))))
    print(f'Finished {rounds} rounds; {failures} failed checks. Observations: {args.output}', flush=True)
    return int(failures != 0)


if __name__ == '__main__':
    raise SystemExit(main())
