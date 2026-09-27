"""Pinned, authenticated, warm Kev-4B System One endpoint for RISE.

Adapted from Jared Palmer's Apache-2.0 kev-finetune Modal serving recipe at
https://github.com/jaredpalmer/kev/blob/9c41005b2180347c3c646dfc9e50c4428483ec6b/skills/kev-finetune/scripts/kev_modal.py
This file is modified for RISE: serving only, immutable code and model refs,
required bearer secret, and one always-warm container.
"""

import os
import time

import modal

APP_NAME = "rise-kev-pinned"
SECRET_NAME = "rise-kev-api-key"
KEV_CODE_REVISION = "9c41005b2180347c3c646dfc9e50c4428483ec6b"
KEV_MODEL_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
BASE_REVISION = "1001bb4d826a52d1f399e183466143f4da7b741b"
RUN = f"jaredpalmer/kev-4b@{KEV_MODEL_REVISION}"
HF_CACHE = "/hf"

app = modal.App(APP_NAME)
image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git")
    .run_commands(
        "git clone https://github.com/jaredpalmer/kev.git /kev"
        f" && git -C /kev checkout --quiet {KEV_CODE_REVISION}"
    )
    .uv_pip_install("kev[serve] @ file:///kev")
    .uv_pip_install("flash-linear-attention==0.5.2", "triton>=3.7.1")
    .env({
        "HF_HOME": HF_CACHE,
        "HF_HUB_DISABLE_PROGRESS_BARS": "1",
        "TOKENIZERS_PARALLELISM": "false",
        "TRITON_CACHE_DIR": f"{HF_CACHE}/triton-cache",
        "PYTHONUNBUFFERED": "1",
    })
)
hf_cache = modal.Volume.from_name("rise-kev-hf-cache", create_if_missing=True)
api_secret = modal.Secret.from_name(SECRET_NAME)

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
            "frustration": {
                "type": "score", "instructions": "How frustrated is the customer?",
                "criteria": ["Calm", "Frustrated", "Very angry"],
            },
        },
    }
    for n in (1, 4, 16)
]


def require_api_key():
    """Kev's own middleware is public when KEV_API_KEY is unset; fail closed first."""
    if not os.environ.get("KEV_API_KEY", "").strip():
        raise RuntimeError(f"Modal secret {SECRET_NAME} must contain a nonempty KEV_API_KEY")


@app.cls(
    image=image,
    gpu="L40S",
    cpu=2,
    memory=(16384, 65536),
    volumes={HF_CACHE: hf_cache},
    secrets=[api_secret],
    min_containers=1,
    scaledown_window=300,
    timeout=600,
    startup_timeout=900,
)
@modal.concurrent(max_inputs=8)
class Serve:
    @modal.enter()
    def load(self):
        require_api_key()
        import torch
        from kev.api import SystemOneRequest
        from kev.checkpoint import Checkpoint, LoadOptions
        from kev.serve import Server, app as api

        started = time.time()
        checkpoint = Checkpoint(RUN)
        served_revision = checkpoint.requested.partition("@")[2]
        if (served_revision != KEV_MODEL_REVISION
                or checkpoint.meta.base != "Qwen/Qwen3.5-4B-Base"
                or checkpoint.meta.base_revision != BASE_REVISION):
            raise RuntimeError("The pinned Kev checkpoint has unexpected base model metadata")
        tokenizer, model = checkpoint.load(
            "cuda", LoadOptions(dtype=torch.bfloat16, cuda_graphs=True, fused=True)
        )
        server = api.state.server = Server(checkpoint, tokenizer, model, "cuda")
        for request in WARMUP:
            server.answer(SystemOneRequest.model_validate(request))
        server.wait_idle()
        hf_cache.commit()
        # This header is added only after the pinned checkpoint and its base
        # have been validated and loaded in this container.
        @api.middleware("http")
        async def attest_revision(request, call_next):
            response = await call_next(request)
            if request.url.path.startswith("/v1/"):
                response.headers["X-Kev-Revision"] = served_revision
            return response

        print(f"Serving {RUN} on {torch.cuda.get_device_name(0)}; warm in {time.time() - started:.0f}s", flush=True)
        self.api = api

    @modal.asgi_app(label="rise-kev-api")
    def web(self):
        return self.api
