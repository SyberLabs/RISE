import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from unittest.mock import Mock, patch

from smoke import EXPECTED_REVISION, RUN, check, request, required_environment


class SmokeConfigurationTests(unittest.TestCase):
    def test_accepts_pinned_https_origin_and_nonempty_key(self):
        with patch.dict("os.environ", {
            "KEV_BASE_URL": "https://rise-kev-preview.example.workers.dev",
            "KEV_API_KEY": "test-secret", "KEV_MODEL": "kev-latest",
            "KEV_REVISION": EXPECTED_REVISION,
        }, clear=True):
            self.assertEqual(required_environment()[0],
                             "https://rise-kev-preview.example.workers.dev")

    def test_rejects_missing_key_or_mutable_revision(self):
        common = {"KEV_BASE_URL": "https://rise-kev-preview.example.workers.dev",
                  "KEV_MODEL": "kev-latest", "KEV_REVISION": EXPECTED_REVISION}
        with patch.dict("os.environ", common, clear=True):
            with self.assertRaisesRegex(ValueError, "KEV_API_KEY"):
                required_environment()
        with patch.dict("os.environ", {**common, "KEV_API_KEY": "secret", "KEV_REVISION": "main"}, clear=True):
            with self.assertRaisesRegex(ValueError, "KEV_REVISION"):
                required_environment()

    def test_rejects_path_or_http(self):
        common = {"KEV_API_KEY": "secret", "KEV_MODEL": "kev-latest",
                  "KEV_REVISION": EXPECTED_REVISION}
        for origin in ("http://preview.example.workers.dev", "https://preview.example.workers.dev/v1"):
            with self.subTest(origin=origin), patch.dict("os.environ", {**common, "KEV_BASE_URL": origin}, clear=True):
                with self.assertRaisesRegex(ValueError, "KEV_BASE_URL"):
                    required_environment()

    def test_loopback_requires_explicit_opt_in(self):
        common = {"KEV_API_KEY": "secret", "KEV_MODEL": "kev-latest",
                  "KEV_REVISION": EXPECTED_REVISION}
        with patch.dict("os.environ", {**common, "KEV_BASE_URL": "http://127.0.0.1:8009"}, clear=True):
            with self.assertRaisesRegex(ValueError, "KEV_BASE_URL"):
                required_environment()
            self.assertEqual(required_environment(allow_loopback=True)[0], "http://127.0.0.1:8009")
        with patch.dict("os.environ", {**common, "KEV_BASE_URL": "https://kev.example.com"}, clear=True):
            self.assertEqual(required_environment(allow_loopback=True)[0], "https://kev.example.com")

    def test_probe_accepts_loopback_only_with_the_same_opt_in(self):
        import probe
        env = {"KEV_BASE_URL": "http://127.0.0.1:8009", "KEV_API_KEY": "secret",
               "KEV_MODEL": "kev-latest", "KEV_REVISION": EXPECTED_REVISION}
        with patch.dict("os.environ", env, clear=True):
            with self.assertRaisesRegex(ValueError, "KEV_BASE_URL"):
                probe.main([])
            with patch("probe.request", return_value=(503, None, {"X-Kev-Revision": EXPECTED_REVISION})) as sent, \
                    patch("builtins.print"):
                self.assertEqual(probe.main(["--allow-loopback"]), 1)
            self.assertEqual(sent.call_count, len(probe.CASES))

    def test_loopback_opt_in_rejects_everything_but_an_explicit_loopback_port(self):
        common = {"KEV_API_KEY": "secret", "KEV_MODEL": "kev-latest",
                  "KEV_REVISION": EXPECTED_REVISION}
        for origin in ("http://127.0.0.1", "http://127.0.0.1:0", "http://127.0.0.1:65536",
                       "http://127.0.0.1:port", "http://localhost:8009", "http://192.168.1.20:8009",
                       "http://kev.example.com:8009", "http://127.0.0.1.example.com:8009",
                       "http://127.0.0.1:8009@example.com", "http://user:pass@127.0.0.1:8009",
                       "http://127.0.0.1:8009/v1", "http://127.0.0.1:8009?next=x",
                       "http://127.0.0.1:8009#x", "http://[::1]:8009", "ftp://127.0.0.1:8009"):
            with self.subTest(origin=origin), \
                    patch.dict("os.environ", {**common, "KEV_BASE_URL": origin}, clear=True):
                with self.assertRaisesRegex(ValueError, "KEV_BASE_URL"):
                    required_environment(allow_loopback=True)

    def test_loopback_requests_bypass_configured_proxies(self):
        class Models(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(401)
                self.send_header("X-Kev-Revision", EXPECTED_REVISION)
                self.end_headers()

            def log_message(self, *_):
                pass

        local = HTTPServer(("127.0.0.1", 0), Models)
        thread = Thread(target=local.serve_forever, daemon=True)
        thread.start()
        try:
            with patch("smoke.OPENER", Mock(open=Mock(side_effect=AssertionError("used the proxy-aware opener")))):
                status, _, headers = request(f"http://127.0.0.1:{local.server_port}", "/v1/models", "secret")
            self.assertEqual(status, 401)
            self.assertEqual(headers.get("X-Kev-Revision"), EXPECTED_REVISION)
        finally:
            local.shutdown()
            local.server_close()
            thread.join(timeout=2)

    def test_requires_serving_revision_on_every_v1_response(self):
        common = {"KEV_BASE_URL": "https://rise-kev-preview.example.workers.dev",
                  "KEV_API_KEY": "secret", "KEV_MODEL": "kev-latest",
                  "KEV_REVISION": EXPECTED_REVISION}
        card = {"models": [{"name": "kev-latest", "run": RUN,
                            "base": "Qwen/Qwen3.5-4B-Base"}]}
        result = {"model": "kev-latest", "answers": {
            "department": {"type": "choice", "choice": "returns",
                           "confidence": 0.6,
                           "probabilities": {"returns": 0.8, "shipping": 0.2}},
            "escalate": {"type": "noul", "noul": 0.1}}}
        responses = [(401, None, {"X-Kev-Revision": EXPECTED_REVISION}),
                     (401, None, {"X-Kev-Revision": EXPECTED_REVISION}),
                     (200, card, {"X-Kev-Revision": EXPECTED_REVISION}),
                     (200, result, {"X-Kev-Revision": EXPECTED_REVISION})]
        with patch.dict("os.environ", common, clear=True), patch("smoke.request", side_effect=responses):
            check()
        for missing in range(len(responses)):
            altered = list(responses)
            status, body, _ = altered[missing]
            altered[missing] = (status, body, {})
            with self.subTest(missing=missing), patch.dict("os.environ", common, clear=True), \
                    patch("smoke.request", side_effect=altered):
                with self.assertRaisesRegex(AssertionError, "X-Kev-Revision"):
                    check()

    def test_does_not_follow_redirect_or_forward_bearer(self):
        destination_hits = []

        class Destination(BaseHTTPRequestHandler):
            def do_GET(self):
                destination_hits.append(self.headers.get("Authorization"))
                self.send_response(200)
                self.end_headers()

            def log_message(self, *_):
                pass

        destination = HTTPServer(("127.0.0.1", 0), Destination)

        class Redirect(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(302)
                self.send_header("Location", f"http://127.0.0.1:{destination.server_port}/v1/models")
                self.end_headers()

            def log_message(self, *_):
                pass

        source = HTTPServer(("127.0.0.1", 0), Redirect)
        threads = [Thread(target=server.serve_forever, daemon=True) for server in (source, destination)]
        try:
            for thread in threads:
                thread.start()
            status, _, _ = request(f"http://127.0.0.1:{source.server_port}", "/v1/models", "secret")
            self.assertEqual(status, 302)
            self.assertEqual(destination_hits, [])
        finally:
            for server in (source, destination):
                server.shutdown()
                server.server_close()
            for thread in threads:
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
