"""Pinned, authenticated Kev-4B System One endpoint on this machine's GPU, loopback only.

The one local Kev server for RISE: `npm run local` (local/rise-local.mjs)
starts it. It keeps the retired hosted wrapper's rules:
immutable model pins, a required bearer key, synthetic warm-up, and
X-Kev-Revision attestation, served by upstream kev.serve in one process on
127.0.0.1. It fails at startup rather than falling back to CPU, another
checkpoint or model size, or hosted inference.

Progress lines for the launcher: "RISE_KEV_STATE <state> <message>".
"""

import argparse
import os
import sys
import time

HOST = "127.0.0.1"
PORT = 8009
KEV_CODE_REVISION = "9c41005b2180347c3c646dfc9e50c4428483ec6b"
KEV_MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
EXPECTED_BASE = "Qwen/Qwen3.5-4B-Base"
BASE_REVISION = "1001bb4d826a52d1f399e183466143f4da7b741b"
RUN = f"jaredpalmer/kev-4b@{KEV_MODEL_REVISION}"
# First qualification configuration on CUDA; change only in response to a measured failure.
LOAD_OPTIONS = {"cuda_graphs": False, "fused": False, "backend": "torch"}
# Apple Silicon: upstream kev.serve's defaults there (MLX for the hybrid Qwen3.5 base). Not yet run on a Mac.
MPS_LOAD_OPTIONS = {"attn": "sdpa", "backend": "auto"}

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


def state(name, message=""):
    print(f"RISE_KEV_STATE {name} {message}".rstrip(), flush=True)


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


def check_pins(checkpoint):
    """The adapter actually fetched, its base, and the base revision must be exactly the pinned ones.

    The Hub cache keeps a snapshot under snapshots/<commit>; that directory is what was fetched,
    independent of what was asked for."""
    fetched = os.path.basename(os.path.normpath(str(checkpoint.path)))
    if (checkpoint.requested.partition("@")[2] != KEV_MODEL_REVISION or fetched != KEV_MODEL_REVISION
            or checkpoint.meta.base != EXPECTED_BASE or checkpoint.meta.base_revision != BASE_REVISION):
        raise RuntimeError("The pinned Kev checkpoint has unexpected revision or base model metadata")
    return fetched


def memory_verdict(free_ram_mib, min_ram_mib, free_vram_mib=None, min_vram_mib=0):
    """None when loading may proceed, else a plain reason. Nothing is closed to make room."""
    if free_ram_mib < min_ram_mib:
        return (f"Only {free_ram_mib} MiB of system memory is free; loading Kev needs about {min_ram_mib} MiB. "
                "RISE did not close anything.")
    if free_vram_mib is not None and free_vram_mib < min_vram_mib:
        return f"Only {free_vram_mib} MiB of GPU memory is free; Kev-4B needs about {min_vram_mib} MiB."
    return None


def check_memory_now(torch, device):
    """Recheck right before the weights load; the first-run download can take many minutes.
    Active only when the launcher sets the thresholds."""
    min_ram = int(os.environ.get("RISE_KEV_MIN_RAM_MIB", "0"))
    min_vram = int(os.environ.get("RISE_KEV_MIN_VRAM_MIB", "0"))
    if not min_ram and not min_vram:
        return None
    import psutil  # a dependency of accelerate, which Kev requires
    free_vram = torch.cuda.mem_get_info()[0] // (1024 * 1024) if device == "cuda" else None
    return memory_verdict(psutil.virtual_memory().available // (1024 * 1024), min_ram, free_vram, min_vram)


def select_device(torch):
    """CUDA, or Apple Silicon through MLX. Never CPU."""
    if torch.cuda.is_available():
        return "cuda", LOAD_OPTIONS
    mps = getattr(getattr(torch, "backends", None), "mps", None)
    if sys.platform == "darwin" and mps is not None and mps.is_available():
        return "mps", MPS_LOAD_OPTIONS
    raise RuntimeError("CUDA is unavailable and this is not Apple Silicon; refusing to serve Kev on CPU")


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

    device, options = select_device(torch)
    started = time.time()
    state("downloading", f"Fetching pinned {RUN} and {EXPECTED_BASE}@{BASE_REVISION[:12]} (first run only).")
    checkpoint = Checkpoint(RUN)
    served_revision = check_pins(checkpoint)
    refusal = check_memory_now(torch, device)
    if refusal:
        raise MemoryError(refusal)
    label = torch.cuda.get_device_name(0) if device == "cuda" else "Apple Silicon (MLX)"
    state("loading", f"Loading Kev onto {label}.")
    tokenizer, model = checkpoint.load(device, LoadOptions(dtype=torch.bfloat16, **options))
    server = app.state.server = Server(checkpoint, tokenizer, model, device)
    try:
        for request in WARMUP:
            server.answer(SystemOneRequest.model_validate(request))
        server.wait_idle()
    except BaseException:
        server.close()
        raise
    print(f"Serving {RUN} on {label} with {options}, prefix cache off; "
          f"warm in {time.time() - started:.0f}s", flush=True)
    state("ready", label)
    return attest_revision(app, served_revision), server


def main(argv=()):
    parser = argparse.ArgumentParser(description="Serve pinned Kev-4B on 127.0.0.1 only.")
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args(list(argv))
    try:
        app, server = build()
    except Exception as error:
        state("error", f"{type(error).__name__}: {error}"[:400])
        raise
    import uvicorn
    try:
        uvicorn.run(app, host=HOST, port=args.port, workers=1, reload=False)
    finally:
        server.close()


if __name__ == "__main__":
    main(sys.argv[1:])
