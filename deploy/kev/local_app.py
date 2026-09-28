"""Pinned, authenticated Kev-4B System One endpoint on this machine's GPU, loopback only.

The local counterpart of modal_app.py: the same immutable model pins, required
bearer key, synthetic warm-up, and X-Kev-Revision attestation, served by
upstream kev.serve in one process on 127.0.0.1:8009. It fails at startup
rather than falling back to CPU, another checkpoint, or hosted inference.
Start it with deploy/kev/local.ps1.
"""

import os
import time

HOST = "127.0.0.1"
PORT = 8009
KEV_MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
EXPECTED_BASE = "Qwen/Qwen3.5-4B-Base"
BASE_REVISION = "1001bb4d826a52d1f399e183466143f4da7b741b"
RUN = f"jaredpalmer/kev-4b@{KEV_MODEL_REVISION}"
# First qualification configuration; change only in response to a measured failure.
LOAD_OPTIONS = {"cuda_graphs": False, "fused": False, "backend": "torch"}

TICKET = "Shoes arrived two weeks late and in the wrong size. I also see two charges on my card. "
WARMUP = [
    {
        "state": TICKET * n,
        "model": "kev-latest",
        "questions": {
            "department": {
                "type": "choice",
                "instructions": "Which team should handle this?",
                "criteria": {"returns": "Exchanges, refunds", "shipping": "Delivery delays", "billing": "Charges"},
            },
            "escalate": {"type": "noul", "instructions": "Does this need urgent human attention?"},
        },
    }
    for n in (1, 4, 16)
]


def attest_revision(app, revision):
    """ASGI wrapper that stamps every /v1/ response, including upstream's 401s, with the loaded revision."""
    header = (b"x-kev-revision", revision.encode("ascii"))

    async def attested(scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/v1/"):
            return await app(scope, receive, send)

        async def send_attested(message):
            if message["type"] == "http.response.start":
                message = {**message, "headers": [*message.get("headers", []), header]}
            await send(message)

        return await app(scope, receive, send_attested)

    return attested


def build():
    """Validate, load, and warm the pinned checkpoint. -> (ASGI app, upstream Server)."""
    # kev.serve reads both at import: an unset key would serve without auth.
    if not os.environ.get("KEV_API_KEY", "").strip():
        raise RuntimeError("KEV_API_KEY must be set to a nonempty key before starting")
    os.environ["KEV_PREFIX_CACHE"] = "0"

    import torch
    from kev.api import SystemOneRequest
    from kev.checkpoint import Checkpoint, LoadOptions
    from kev.serve import Server, app

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable; refusing to serve Kev on CPU")
    started = time.time()
    checkpoint = Checkpoint(RUN)
    served_revision = checkpoint.requested.partition("@")[2]
    if (served_revision != KEV_MODEL_REVISION
            or checkpoint.meta.base != EXPECTED_BASE
            or checkpoint.meta.base_revision != BASE_REVISION):
        raise RuntimeError("The pinned Kev checkpoint has unexpected revision or base model metadata")
    tokenizer, model = checkpoint.load("cuda", LoadOptions(dtype=torch.bfloat16, **LOAD_OPTIONS))
    server = app.state.server = Server(checkpoint, tokenizer, model, "cuda")
    try:
        for request in WARMUP:
            server.answer(SystemOneRequest.model_validate(request))
        server.wait_idle()
    except BaseException:
        server.close()
        raise
    print(f"Serving {RUN} on {torch.cuda.get_device_name(0)} with {LOAD_OPTIONS}, prefix cache off; "
          f"warm in {time.time() - started:.0f}s at http://{HOST}:{PORT}", flush=True)
    return attest_revision(app, served_revision), server


def main():
    app, server = build()
    import uvicorn
    try:
        uvicorn.run(app, host=HOST, port=PORT, workers=1, reload=False)
    finally:
        server.close()


if __name__ == "__main__":
    main()
