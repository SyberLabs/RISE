"""Pinned Kev-4B for local RISE: upstream kev.serve on loopback, attested.

Adapted from Jared Palmer's Apache-2.0 Kev serving code at
https://github.com/jaredpalmer/kev/blob/9c41005b2180347c3c646dfc9e50c4428483ec6b/kev/serve.py
(the load path RISE's retired hosted deployment used). RISE changes: loopback
only, a required per-run bearer key, the immutable checkpoint and base pins
checked before the model loads, and an X-Kev-Revision header that exists only
after that check passed. It never substitutes another model, size, or device.

Progress lines for the launcher: "RISE_KEV_STATE <state> <message>".
"""

import argparse
import ipaddress
import os
import sys

KEV_CODE_REVISION = "9c41005b2180347c3c646dfc9e50c4428483ec6b"
KEV_MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
BASE = "Qwen/Qwen3.5-4B-Base"
BASE_REVISION = "1001bb4d826a52d1f399e183466143f4da7b741b"
RUN = f"jaredpalmer/kev-4b@{KEV_MODEL_REVISION}"
WARMUP = {
    "state": "Synthetic reader intent: a slow, quiet reading.",
    "model": "kev-latest",
    "questions": {"pace": {"type": "choice", "instructions": "Choose the reading speed.",
                           "criteria": {"100": "Very slow.", "300": "Fast."}}},
}


def state(name, message=""):
    print(f"RISE_KEV_STATE {name} {message}".rstrip(), flush=True)


def loopback(host):
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def check_pins(checkpoint):
    """The adapter actually downloaded, its base, and the base revision must be exactly the pinned ones.

    The Hub cache stores a snapshot under snapshots/<commit>; that directory name is what was fetched,
    independent of what was asked for."""
    fetched = os.path.basename(os.path.normpath(str(checkpoint.path)))
    if checkpoint.requested.partition("@")[2] != KEV_MODEL_REVISION or fetched != KEV_MODEL_REVISION:
        raise RuntimeError(f"Kev checkpoint snapshot {fetched!r} is not the pinned {KEV_MODEL_REVISION}")
    if checkpoint.meta.base != BASE or checkpoint.meta.base_revision != BASE_REVISION:
        raise RuntimeError("The Kev checkpoint names an unexpected base model or base revision")
    return fetched


def memory_verdict(free_ram_mib, min_ram_mib, free_vram_mib=None, min_vram_mib=0):
    """None when loading may proceed, else a plain reason. Nothing is closed to make room."""
    if free_ram_mib < min_ram_mib:
        return (f"Only {free_ram_mib} MiB of system memory is free; loading Kev needs about {min_ram_mib} MiB. "
                "RISE did not close anything.")
    if free_vram_mib is not None and free_vram_mib < min_vram_mib:
        return f"Only {free_vram_mib} MiB of GPU memory is free; Kev-4B needs about {min_vram_mib} MiB."
    return None


def check_memory_now(device):
    """Recheck right before the weights load (the first-run download can take many minutes)."""
    import psutil  # a dependency of accelerate, which Kev requires
    free_ram = psutil.virtual_memory().available // (1024 * 1024)
    free_vram = None
    if device == "cuda":
        import torch
        free_vram = torch.cuda.mem_get_info()[0] // (1024 * 1024)
    return memory_verdict(free_ram, int(os.environ.get("RISE_KEV_MIN_RAM_MIB", "0")),
                          free_vram, int(os.environ.get("RISE_KEV_MIN_VRAM_MIB", "0")))


def device_label(device):
    if device == "cuda":
        import torch
        return torch.cuda.get_device_name(0)
    if device == "mps":
        return "Apple Silicon (MLX)"
    return device


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args(argv)
    if not loopback(args.host):
        state("error", "Kev binds to this computer only (loopback).")
        return 2
    # kev.serve reads KEV_API_KEY at import; without it the server is open.
    if len(os.environ.get("KEV_API_KEY", "")) < 32:
        state("error", "The launcher did not provide a per-run key.")
        return 2

    state("loading", "Importing Kev.")
    from dataclasses import replace
    import torch
    from kev import serve
    from kev.api import SystemOneRequest
    from kev.checkpoint import Checkpoint, LoadOptions, fused_available
    from kev.device import default_device

    device = default_device()
    if device == "cpu":
        # RISE does not promise CPU performance and does not switch model size.
        state("error", "No supported GPU: local Kev needs an NVIDIA GPU (CUDA) or Apple Silicon.")
        return 3

    state("downloading", f"Fetching pinned {RUN} and {BASE}@{BASE_REVISION[:12]} (first run only).")
    checkpoint = Checkpoint(RUN)
    served_revision = check_pins(checkpoint)

    # The upstream serving defaults (kev.serve.main), unchanged.
    options = LoadOptions.from_env()
    if device == "mps" and options.attn is None:
        options = replace(options, attn="sdpa")
    if options.dtype is None:
        options = replace(options, dtype=torch.bfloat16)
    if device == "cuda" and options.cuda_graphs is None:
        options = replace(options, cuda_graphs=True)
    if device == "cuda" and options.fused is None:
        options = replace(options, fused=fused_available())
    if options.backend is None:
        options = replace(options, backend="auto")

    refusal = check_memory_now(device)
    if refusal:
        state("error", refusal)
        return 4
    state("loading", f"Loading Kev onto {device_label(device)}.")
    tokenizer, model = checkpoint.load(device, options)
    server = serve.app.state.server = serve.Server(checkpoint, tokenizer, model, device)
    server.answer(SystemOneRequest.model_validate(WARMUP))
    server.wait_idle()

    @serve.app.middleware("http")
    async def attest_revision(request, call_next):
        # Added only after the pinned checkpoint and base were checked and loaded.
        response = await call_next(request)
        if request.url.path.startswith("/v1/"):
            response.headers["X-Kev-Revision"] = served_revision
        return response

    import uvicorn
    state("ready", device_label(device))
    uvicorn.run(serve.app, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # the launcher shows this line; the traceback stays in this terminal
        state("error", f"{type(error).__name__}: {error}"[:400])
        raise
