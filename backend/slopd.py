#!/usr/bin/env python3
"""slopd: the real (!) guestbook and visitor counter behind slop.kyouma.net.

Standard library only. Serves a tiny JSON API on 127.0.0.1; Caddy proxies /api/* to it.

  GET  /api/guestbook[?before=<id>]          newest visible entries (paged)
  POST /api/guestbook {"name","message","website"}   sign it ("website" is a honeypot)
  GET  /api/visits                           {"total"}
  POST /api/visits                           count this visit -> {"visitor","total","counted"}

Visits are deduplicated per client IP for 30 minutes. IPs are never written to disk: they are
only kept in memory, hashed with a per-process random salt, for rate limiting and dedup.

Moderation (run as the service user, e.g. via `slopctl`):
  slopd.py list [-n N] [--all] | hide ID... | unhide ID... | delete ID... | set-visits N
"""
import argparse
import hashlib
import json
import re
import secrets
import sqlite3
import sys
import threading
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

MAX_BODY = 4096
NAME_MAX, MSG_MAX = 40, 280
PAGE_SIZE = 30
VISIT_DEDUP_SECONDS = 30 * 60
ALLOWED_ORIGINS = {'https://slop.kyouma.net'}
POST_LIMITS_PER_IP = [(30, 1), (3600, 5), (86400, 15)]  # (window seconds, max posts)
POST_LIMITS_GLOBAL = [(3600, 300)]
DEFAULT_NAMES = ['anonymous pig', 'a shy slopper', 'guest', 'Gerald (probably)', 'mysterious ladle']

URL_RE = re.compile(r'(?i)[a-z][a-z0-9+.-]*://|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|ru|xyz|top|info|io|cn|biz|link|click|shop|site|online)\b')
BIDI = dict.fromkeys(map(ord, '‎‏‪‫‬‭‮⁦⁧⁨⁩'), None)
SALT = secrets.token_bytes(16)


def clean_text(s):
    """Normalize user text: no control/bidi/unassigned chars, at most 2 stacked combining marks
    (sorry, zalgo), whitespace collapsed to single spaces."""
    s = unicodedata.normalize('NFC', s).translate(BIDI)
    out, marks = [], 0
    for ch in s:
        cat = unicodedata.category(ch)
        if cat == 'Cc':
            ch, cat = ' ', 'Zs'
        elif cat in ('Cs', 'Co', 'Cn'):
            continue
        if cat in ('Mn', 'Me'):
            marks += 1
            if marks > 2:
                continue
        else:
            marks = 0
        out.append(ch)
    return re.sub(r'\s+', ' ', ''.join(out)).strip()


def ip_key(ip):
    return hashlib.blake2b(ip.encode(), key=SALT, digest_size=12).hexdigest()


class Limiter:
    """In-memory sliding-window rate limiter."""

    def __init__(self):
        self.lock = threading.Lock()
        self.hits = {}

    def allow(self, key, rules):
        now = time.time()
        longest = max(w for w, _ in rules)
        with self.lock:
            ts = [t for t in self.hits.get(key, ()) if now - t < longest]
            if any(sum(1 for t in ts if now - t < w) >= n for w, n in rules):
                self.hits[key] = ts
                return False
            ts.append(now)
            self.hits[key] = ts
            if len(self.hits) > 20000:
                self.hits = {k: v for k, v in self.hits.items() if v and now - v[-1] < 86400}
            return True


class Store:
    def __init__(self, path):
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.execute('PRAGMA busy_timeout=5000')
        self.conn.executescript('''
            CREATE TABLE IF NOT EXISTS entries (
                id      INTEGER PRIMARY KEY,
                name    TEXT    NOT NULL,
                message TEXT    NOT NULL,
                created INTEGER NOT NULL,
                hidden  INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
            INSERT OR IGNORE INTO counters VALUES ('visits', 0);
        ''')

    def entries(self, before=None, limit=PAGE_SIZE, include_hidden=False):
        q = 'SELECT id, name, message, created, hidden FROM entries WHERE 1=1'
        args = []
        if not include_hidden:
            q += ' AND hidden = 0'
        if before is not None:
            q += ' AND id < ?'
            args.append(before)
        q += ' ORDER BY id DESC LIMIT ?'
        args.append(limit)
        with self.lock:
            rows = self.conn.execute(q, args).fetchall()
        return [{'id': r[0], 'name': r[1], 'message': r[2], 'created': r[3], 'hidden': bool(r[4])} for r in rows]

    def add_entry(self, name, message):
        now = int(time.time())
        with self.lock:
            cur = self.conn.execute('INSERT INTO entries (name, message, created) VALUES (?, ?, ?)', (name, message, now))
        return {'id': cur.lastrowid, 'name': name, 'message': message, 'created': now}

    def set_hidden(self, ids, hidden):
        with self.lock:
            return self.conn.executemany('UPDATE entries SET hidden = ? WHERE id = ?', [(int(hidden), i) for i in ids]).rowcount

    def delete(self, ids):
        with self.lock:
            return self.conn.executemany('DELETE FROM entries WHERE id = ?', [(i,) for i in ids]).rowcount

    def visits(self):
        with self.lock:
            return self.conn.execute("SELECT value FROM counters WHERE name = 'visits'").fetchone()[0]

    def bump_visits(self):
        with self.lock:
            return self.conn.execute("UPDATE counters SET value = value + 1 WHERE name = 'visits' RETURNING value").fetchone()[0]

    def set_visits(self, n):
        with self.lock:
            self.conn.execute("UPDATE counters SET value = ? WHERE name = 'visits'", (n,))


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class Handler(BaseHTTPRequestHandler):
    server_version = 'slopd'
    sys_version = ''
    protocol_version = 'HTTP/1.1'
    timeout = 15

    store: Store
    limiter: Limiter
    visitors: dict = {}
    visitors_lock = threading.Lock()

    def log_message(self, fmt, *args):  # no client IPs in the journal
        sys.stderr.write('%s\n' % (fmt % args))

    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def client_ip(self):
        # Caddy overwrites X-Forwarded-For with the real client address (no trusted proxies configured),
        # and slopd only listens on loopback, so the header can be trusted.
        xff = self.headers.get('X-Forwarded-For')
        return xff.split(',')[-1].strip() if xff else self.client_address[0]

    def dispatch(self, fn):
        try:
            status, obj = fn()
        except ApiError as e:
            status, obj = e.status, {'error': str(e)}
        except Exception as e:  # pragma: no cover - last resort
            self.log_error('internal error: %r', e)
            status, obj = 500, {'error': 'the slop machine broke. a pig has been dispatched.'}
        self.send_json(status, obj)

    def do_GET(self):
        self.dispatch(self.handle_get)

    def do_POST(self):
        self.dispatch(self.handle_post)

    def handle_get(self):
        url = urlsplit(self.path)
        if url.path == '/api/guestbook':
            before = parse_qs(url.query).get('before', [None])[0]
            try:
                before = int(before) if before is not None else None
            except ValueError:
                raise ApiError(400, 'that is not a number. that is slop.')
            entries = self.store.entries(before)
            for e in entries:
                del e['hidden']
            return 200, {'entries': entries, 'more': len(entries) == PAGE_SIZE}
        if url.path == '/api/visits':
            return 200, {'total': self.store.visits()}
        raise ApiError(404, 'no slop here')

    def read_json(self):
        origin = self.headers.get('Origin')
        if origin and origin not in ALLOWED_ORIGINS:
            self.close_connection = True
            raise ApiError(403, 'wrong trough')
        if not (self.headers.get('Content-Type') or '').startswith('application/json'):
            self.close_connection = True
            raise ApiError(415, 'json only. gerald cannot read other formats.')
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = -1
        if not 0 <= length <= MAX_BODY:
            self.close_connection = True
            raise ApiError(413, 'too much slop')
        try:
            data = json.loads(self.rfile.read(length) or b'{}')
        except ValueError:
            raise ApiError(400, 'that json was sloppier than allowed')
        if not isinstance(data, dict):
            raise ApiError(400, 'that json was sloppier than allowed')
        return data

    def handle_post(self):
        path = urlsplit(self.path).path
        if path not in ('/api/guestbook', '/api/visits'):
            self.close_connection = True
            raise ApiError(404, 'no slop here')
        data = self.read_json()
        key = ip_key(self.client_ip())
        if path == '/api/visits':
            return 200, self.count_visit(key)
        return 201, {'entry': self.sign_guestbook(key, data)}

    def count_visit(self, key):
        now = time.time()
        with self.visitors_lock:
            seen = self.visitors.get(key)
            if seen and now - seen[0] < VISIT_DEDUP_SECONDS:
                return {'visitor': seen[1], 'total': self.store.visits(), 'counted': False}
            n = self.store.bump_visits()
            self.visitors[key] = (now, n)
            if len(self.visitors) > 50000:
                Handler.visitors = {k: v for k, v in self.visitors.items() if now - v[0] < VISIT_DEDUP_SECONDS}
        return {'visitor': n, 'total': n, 'counted': True}

    def sign_guestbook(self, key, data):
        name, message, honeypot = data.get('name', ''), data.get('message', ''), data.get('website', '')
        if not all(isinstance(v, str) for v in (name, message, honeypot)):
            raise ApiError(400, 'strings only please')
        name = clean_text(name)[:NAME_MAX].strip() or secrets.choice(DEFAULT_NAMES)
        message = clean_text(message)
        if not message:
            raise ApiError(400, 'you have to actually write something')
        if len(message) > MSG_MAX:
            raise ApiError(400, f'too long. {MSG_MAX} characters max. this is a guestbook, not a blog.')
        if URL_RE.search(message.replace('slop.kyouma.net', '')) or URL_RE.search(name):
            raise ApiError(400, 'no links please. Gerald does not click links.')
        if honeypot:  # bots fill in every field; pretend it worked and store nothing
            return {'id': 0, 'name': name, 'message': message, 'created': int(time.time())}
        if not self.limiter.allow('ip:' + key, POST_LIMITS_PER_IP):
            raise ApiError(429, 'slow down! Gerald can only read so fast. try again in a bit.')
        if not self.limiter.allow('global', POST_LIMITS_GLOBAL):
            raise ApiError(429, 'the guestbook is full of slop right now. try again later.')
        return self.store.add_entry(name, message)


def serve(args):
    Handler.store = Store(args.db)
    Handler.limiter = Limiter()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True
    print(f'slopd listening on {args.host}:{args.port}, db {args.db}', file=sys.stderr, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--db', default='slopd.sqlite3', help='SQLite database path')
    sub = p.add_subparsers(dest='cmd')
    s = sub.add_parser('serve', help='run the API server (default)')
    s.add_argument('--host', default='127.0.0.1')
    s.add_argument('--port', type=int, default=8787)
    l = sub.add_parser('list', help='show recent guestbook entries')
    l.add_argument('-n', type=int, default=30)
    for cmd in ('hide', 'unhide', 'delete'):
        sub.add_parser(cmd, help=f'{cmd} guestbook entries by id').add_argument('ids', type=int, nargs='+')
    sub.add_parser('set-visits', help='set the visitor counter').add_argument('n', type=int)
    args = p.parse_args()

    if args.cmd in (None, 'serve'):
        if args.cmd is None:
            args.host, args.port = '127.0.0.1', 8787
        return serve(args)
    store = Store(args.db)
    if args.cmd == 'list':
        print(f'visits: {store.visits()}')
        for e in reversed(store.entries(limit=args.n, include_hidden=True)):
            when = time.strftime('%Y-%m-%d %H:%M', time.gmtime(e['created']))
            print(f"{e['id']:>5}  {when}  {'[hidden] ' if e['hidden'] else ''}{e['name']}: {e['message']}")
    elif args.cmd in ('hide', 'unhide'):
        print(f"{store.set_hidden(args.ids, args.cmd == 'hide')} entries {'hidden' if args.cmd == 'hide' else 'unhidden'}")
    elif args.cmd == 'delete':
        print(f'{store.delete(args.ids)} entries deleted')
    elif args.cmd == 'set-visits':
        store.set_visits(args.n)
        print(f'visits set to {args.n}')


if __name__ == '__main__':
    main()
