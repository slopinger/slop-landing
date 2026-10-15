"""Exercise the HTTP API with an ephemeral server and database."""
from contextlib import closing
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location('slopd', Path(__file__).resolve().parents[1] / 'slopd.py')
slopd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(slopd)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='slopd-test-')
        self.store = slopd.Store(str(Path(self.temp.name) / 'test.sqlite3'))
        store = self.store

        class TestHandler(slopd.Handler):
            visitors = {}
            visitors_lock = threading.Lock()
            limiter = slopd.Limiter()

            def log_message(self, *args):
                pass

        TestHandler.store = store
        self.server = slopd.ThreadingHTTPServer(('127.0.0.1', 0), TestHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.01})
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.store.conn.close()
        self.temp.cleanup()

    def request(self, method, path, data=None, *, raw=None, headers=None):
        defaults = {'Origin': 'https://freifick.net', 'Content-Type': 'application/json'}
        defaults.update(headers or {})
        body = raw if raw is not None else (json.dumps(data) if data is not None else None)
        with closing(http.client.HTTPConnection(*self.server.server_address, timeout=3)) as conn:
            conn.request(method, path, body, defaults)
            response = conn.getresponse()
            result = json.loads(response.read())
            self.assertEqual(response.getheader('Cache-Control'), 'no-store')
            return response.status, result

    def test_guestbook_pagination_and_moderation(self):
        status, body = self.request('POST', '/api/guestbook', {'name': '  slop  ', 'message': 'hello basement'})
        self.assertEqual(status, 201)
        entry = body['entry']
        self.assertEqual(entry['name'], 'slop')
        status, body = self.request('GET', '/api/guestbook')
        self.assertEqual(status, 200)
        self.assertEqual([e['id'] for e in body['entries']], [entry['id']])
        self.assertNotIn('hidden', body['entries'][0])
        self.assertEqual(self.request('GET', f"/api/guestbook?before={entry['id']}")[1]['entries'], [])
        self.store.set_hidden([entry['id']], True)
        self.assertEqual(self.request('GET', '/api/guestbook')[1]['entries'], [])
        self.store.set_hidden([entry['id']], False)
        self.assertEqual(len(self.request('GET', '/api/guestbook')[1]['entries']), 1)

    def test_invalid_pagination_cursors(self):
        for value in ('not-a-number', str(2**63), str(-(2**63)-1), '9'*4000):
            with self.subTest(value=value[:30]):
                status, body = self.request('GET', '/api/guestbook?before=' + value)
                self.assertEqual(status, 400)
                self.assertIn('error', body)
        self.assertEqual(self.request('GET', '/api/guestbook?before=' + str(2**63-1))[0], 200)

    def test_visits_are_deduplicated_per_ip(self):
        status, first = self.request('POST', '/api/visits', {})
        self.assertEqual(status, 200)
        self.assertTrue(first['counted'])
        _, again = self.request('POST', '/api/visits', {})
        self.assertFalse(again['counted'])
        self.assertEqual(first['visitor'], again['visitor'])
        _, another = self.request('POST', '/api/visits', {}, headers={'X-Forwarded-For': '192.0.2.2'})
        self.assertTrue(another['counted'])
        self.assertEqual(another['total'], 2)

    def test_pot_caps_and_invalid_values(self):
        self.assertEqual(self.request('GET', '/api/pot'), (200, {'splats': 0, 'ladles': 0}))
        self.assertEqual(self.request('POST', '/api/pot', {'splats': 500, 'ladles': 500}),
                         (200, {'splats': 50, 'ladles': 20}))
        for value in (True, -1, '1', 1.5, None):
            with self.subTest(value=value):
                self.assertEqual(self.request('POST', '/api/pot', {'splats': value})[0], 400)
        self.assertEqual(self.request('GET', '/api/pot')[1], {'splats': 50, 'ladles': 20})

    def test_bad_json_and_origin(self):
        for raw in ('[1,2]', 'null', '{broken'):
            self.assertEqual(self.request('POST', '/api/visits', raw=raw)[0], 400)
        self.assertEqual(self.request('POST', '/api/visits', {}, headers={'Origin': 'https://elsewhere.test'})[0], 403)
        self.assertEqual(self.store.visits(), 0)

    def test_content_type(self):
        for value in ('text/plain', 'application/jsonp', 'application/json-invalid'):
            with self.subTest(value=value):
                self.assertEqual(self.request('POST', '/api/visits', {}, headers={'Content-Type': value})[0], 415)
        for value in ('application/json; charset=utf-8', 'Application/JSON'):
            self.assertEqual(self.request('POST', '/api/visits', {}, headers={'Content-Type': value})[0], 200)


if __name__ == '__main__':
    unittest.main()
