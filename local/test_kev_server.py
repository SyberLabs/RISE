"""Kev server guards that run without torch, weights, or a GPU."""

import io
import os
import sys
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import kev_server  # noqa: E402


def checkpoint(revision=kev_server.KEV_MODEL_REVISION, base=kev_server.BASE, base_revision=kev_server.BASE_REVISION):
    return SimpleNamespace(requested=f"jaredpalmer/kev-4b@{revision}",
                           meta=SimpleNamespace(base=base, base_revision=base_revision))


class KevServerGuards(unittest.TestCase):
    def test_pins_match_the_reader_contract(self):
        with open(os.path.join(os.path.dirname(__file__), "..", "src", "core", "decision", "providers.js"), encoding="utf-8") as source:
            text = source.read()
        for value in (kev_server.KEV_CODE_REVISION, kev_server.KEV_MODEL_REVISION, kev_server.BASE, kev_server.BASE_REVISION):
            self.assertIn(value, text)

    def test_accepts_only_the_pinned_checkpoint_and_base(self):
        self.assertEqual(kev_server.check_pins(checkpoint()), kev_server.KEV_MODEL_REVISION)
        for bad in (checkpoint(revision="main"), checkpoint(base="Qwen/Qwen3-4B-Instruct"),
                    checkpoint(base_revision="0" * 40)):
            with self.assertRaises(RuntimeError):
                kev_server.check_pins(bad)

    def test_binds_to_loopback_only(self):
        for host in ("127.0.0.1", "::1", "localhost"):
            self.assertTrue(kev_server.loopback(host), host)
        for host in ("0.0.0.0", "192.168.1.20", "example.com", "::"):
            self.assertFalse(kev_server.loopback(host), host)

    def test_refuses_to_start_open_or_exposed(self):
        with redirect_stdout(io.StringIO()) as out, mock.patch.dict(os.environ, {"KEV_API_KEY": ""}):
            self.assertEqual(kev_server.main(["--port", "9"]), 2)
        self.assertIn("RISE_KEV_STATE error", out.getvalue())
        with redirect_stdout(io.StringIO()) as out, mock.patch.dict(os.environ, {"KEV_API_KEY": "k" * 48}):
            self.assertEqual(kev_server.main(["--host", "0.0.0.0", "--port", "9"]), 2)
        self.assertIn("loopback", out.getvalue())


if __name__ == "__main__":
    unittest.main()
