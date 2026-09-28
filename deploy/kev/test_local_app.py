"""Wrapper unit tests with fake torch/kev modules; they load no model and need no GPU."""

import asyncio
import os
import sys
import types
import unittest
from unittest.mock import patch

import local_app
from local_app import BASE_REVISION, EXPECTED_BASE, KEV_MODEL_REVISION, RUN, attest_revision, build


class FakeCheckpoint:
    meta_base = EXPECTED_BASE
    meta_base_revision = BASE_REVISION
    requested_override = None
    load_error = None
    loads = []

    def __init__(self, run):
        self.requested = self.requested_override or run
        self.meta = types.SimpleNamespace(base=self.meta_base, base_revision=self.meta_base_revision)

    def load(self, device, options):
        if self.load_error:
            raise self.load_error
        FakeCheckpoint.loads.append((device, options))
        return "tokenizer", "model"


class FakeServer:
    instances = []

    def __init__(self, checkpoint, tokenizer, model, device):
        self.device, self.answered, self.closed = device, [], False
        FakeServer.instances.append(self)

    def answer(self, request):
        self.answered.append(request)

    def wait_idle(self):
        pass

    def close(self):
        self.closed = True


async def unauthorized_app(scope, receive, send):
    await send({"type": "http.response.start", "status": 401, "headers": [(b"www-authenticate", b"Bearer")]})
    await send({"type": "http.response.body", "body": b"{}"})


def fake_modules(cuda=True, seen_environment=None):
    torch = types.ModuleType("torch")
    torch.bfloat16 = "bf16"
    torch.cuda = types.SimpleNamespace(is_available=lambda: cuda, get_device_name=lambda _: "Fake GPU")
    api = types.ModuleType("kev.api")
    api.SystemOneRequest = types.SimpleNamespace(model_validate=lambda body: body)
    checkpoint = types.ModuleType("kev.checkpoint")
    checkpoint.Checkpoint = FakeCheckpoint
    checkpoint.LoadOptions = lambda **options: options
    class FastAPI:
        state = types.SimpleNamespace()
        __call__ = staticmethod(unauthorized_app)

    fastapi_app = FastAPI()

    class Serve(types.ModuleType):
        # Upstream reads KEV_API_KEY and KEV_PREFIX_CACHE when kev.serve is imported; record what it would see.
        def __getattr__(self, name):
            if name not in ("Server", "app"):
                raise AttributeError(name)
            if seen_environment is not None:
                seen_environment.update({k: os.environ.get(k) for k in ("KEV_API_KEY", "KEV_PREFIX_CACHE")})
            return {"Server": FakeServer, "app": fastapi_app}[name]

    return {"torch": torch, "kev": types.ModuleType("kev"), "kev.api": api,
            "kev.checkpoint": checkpoint, "kev.serve": Serve("kev.serve")}


def call(app, path):
    sent = []

    async def send(message):
        sent.append(message)

    asyncio.run(app({"type": "http", "path": path}, None, send))
    return dict(sent[0]["headers"])


class LocalAppTests(unittest.TestCase):
    def setUp(self):
        FakeCheckpoint.requested_override = FakeCheckpoint.load_error = None
        FakeCheckpoint.meta_base, FakeCheckpoint.meta_base_revision = EXPECTED_BASE, BASE_REVISION
        FakeCheckpoint.loads, FakeServer.instances = [], []

    def build_with(self, env, **modules):
        with patch.dict(os.environ, env, clear=True), patch.dict(sys.modules, fake_modules(**modules)):
            return build()

    def test_requires_nonempty_key_before_importing_kev(self):
        for env in ({}, {"KEV_API_KEY": "   "}):
            with self.subTest(env=env), patch.dict(os.environ, env, clear=True), \
                    patch.dict(sys.modules, {"kev.serve": None}):
                with self.assertRaisesRegex(RuntimeError, "KEV_API_KEY"):
                    build()
        self.assertEqual(FakeCheckpoint.loads, [])

    def test_upstream_sees_key_and_disabled_prefix_cache_at_import(self):
        seen = {}
        self.build_with({"KEV_API_KEY": "secret", "KEV_PREFIX_CACHE": "4"}, seen_environment=seen)
        self.assertEqual(seen, {"KEV_API_KEY": "secret", "KEV_PREFIX_CACHE": "0"})

    def test_refuses_cpu(self):
        with self.assertRaisesRegex(RuntimeError, "CUDA"):
            self.build_with({"KEV_API_KEY": "secret"}, cuda=False)
        self.assertEqual(FakeCheckpoint.loads, [])

    def test_rejects_unexpected_checkpoint_metadata_before_loading(self):
        cases = [("requested_override", "jaredpalmer/kev-4b@main"),
                 ("meta_base", "Qwen/Qwen3.5-0.8B-Base"),
                 ("meta_base_revision", "main")]
        for attribute, value in cases:
            self.setUp()
            setattr(FakeCheckpoint, attribute, value)
            with self.subTest(attribute=attribute), self.assertRaisesRegex(RuntimeError, "pinned"):
                self.build_with({"KEV_API_KEY": "secret"})
            self.assertEqual(FakeCheckpoint.loads, [])

    def test_load_failure_propagates_without_serving(self):
        FakeCheckpoint.load_error = MemoryError("CUDA out of memory")
        with self.assertRaises(MemoryError):
            self.build_with({"KEV_API_KEY": "secret"})
        self.assertEqual(FakeServer.instances, [])

    def test_warmup_failure_stops_model_thread(self):
        with patch.object(FakeServer, "answer", side_effect=RuntimeError("CUDA error")):
            with self.assertRaisesRegex(RuntimeError, "CUDA error"):
                self.build_with({"KEV_API_KEY": "secret"})
        self.assertTrue(FakeServer.instances[0].closed)

    def test_loads_pinned_run_on_cuda_eager_bf16_and_warms_up(self):
        _, server = self.build_with({"KEV_API_KEY": "secret"})
        self.assertEqual(FakeCheckpoint.loads, [("cuda", {
            "dtype": "bf16", "cuda_graphs": False, "fused": False, "backend": "torch"})])
        self.assertEqual(server.device, "cuda")
        self.assertTrue(server.answered)

    def test_attests_revision_on_v1_responses_including_401(self):
        app, _ = self.build_with({"KEV_API_KEY": "secret"})
        self.assertEqual(call(app, "/v1/models")[b"x-kev-revision"], KEV_MODEL_REVISION.encode())
        self.assertEqual(call(app, "/v1/systemone")[b"www-authenticate"], b"Bearer")
        self.assertNotIn(b"x-kev-revision", call(app, "/docs"))
        self.assertNotIn(b"x-kev-revision", call(attest_revision(unauthorized_app, KEV_MODEL_REVISION), "/v1"))

    def test_serves_one_loopback_process_and_closes_server(self):
        server = FakeServer(None, None, None, "cuda")
        runs = []
        uvicorn = types.SimpleNamespace(run=lambda app, **options: runs.append(options))
        with patch.object(local_app, "build", return_value=("app", server)), \
                patch.dict(sys.modules, {"uvicorn": uvicorn}):
            local_app.main()
        self.assertEqual(runs, [{"host": "127.0.0.1", "port": 8009, "workers": 1, "reload": False}])
        self.assertTrue(server.closed)


if __name__ == "__main__":
    unittest.main()
