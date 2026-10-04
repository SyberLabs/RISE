# Run RISE locally with Kev

Local RISE runs the whole reader and the pinned Kev-4B decision model on your
own computer. There is no hosted inference bill and nothing is exposed to the
network: every service binds to `127.0.0.1`.

## What you need

- **An NVIDIA GPU with at least 10 GB of free video memory** (tested target: Windows with an RTX 5080), **or an Apple Silicon Mac with at least 16 GB of memory** (the MLX path, which has not yet been tested on a Mac). There is no CPU mode, and RISE never switches to a smaller model.
- About 6 GB of free system memory when Kev loads (10 GB on a Mac). The launcher checks right before loading and refuses rather than closing anything.
- Node.js 20.19+ or 22.12+, and Python 3.12 or 3.13 (used only to create an isolated environment).
- About 15 GB of disk for the isolated environment and model cache in `%LOCALAPPDATA%\rise-kev` on Windows or `~/.cache/rise-kev` elsewhere, outside the repository.

## Start

```sh
git clone https://github.com/SyberLabs/RISE && cd RISE
npm ci
npm run local
```

The launcher:

1. Reports the GPU and memory it found (`npm run local -- --check` stops here).
2. Builds RISE once if `dist/` is missing, starts the local bridge at `http://127.0.0.1:5780/`, and opens it. Reading works immediately.
3. On first run, creates the isolated environment in that folder and installs pinned Kev (`jaredpalmer/kev` at `9c41005b2180347c3c646dfc9e50c4428483ec6b`). On NVIDIA it first installs PyTorch 2.8 built for CUDA 12.8, which supports RTX 50-series GPUs. Your system Python and any other environment are left untouched.
4. Rechecks memory, then starts `deploy/kev/local_app.py` on a random loopback port. It downloads and loads:
   - Kev-4B adapter `jaredpalmer/kev-4b@139fdd94f1b6a6ad80cc15e08fcb99cac885a101`
   - base `Qwen/Qwen3.5-4B-Base@1001bb4d826a52d1f399e183466143f4da7b741b`

   It refuses to serve if the snapshot it fetched, or the base it names, differs from these pins, and it checks free memory again after the download and right before loading. Only then does it add the `X-Kev-Revision` header that RISE requires on every answer. Upstream Kev's own serving code (`kev.serve`) handles the requests. On NVIDIA it uses the first qualified configuration: bf16 PyTorch, CUDA graphs off, fused kernels off, prefix cache off. Change that only after a measured failure.
5. The Home panel follows Kev through its states (checking, installing, downloading, loading, then ready, or an error that says why). Ctrl+C stops the bridge and Kev. The launcher stops only the processes it started, and it never reboots or auto-starts anything.

Options: `--port N`, `--no-open`, `--python PATH`, and `--self-test`. Once Kev is ready, `--self-test` checks that Kev refuses missing and wrong keys, reports the pinned checkpoint and base, and attests the revision, and that the bridge returns an attested choice and refuses another website.

## Security

- The bridge answers only when addressed as `127.0.0.1:<port>` or `localhost:<port>`, which refuses DNS-rebinding pages.
- `POST /api/local/kev/systemone` accepts only requests from its own origin (`Origin` and `Sec-Fetch-Site` checks) carrying a JSON System One choice request with `model: kev-latest`. It forwards them to one fixed address, Kev on another loopback port, with a random per-run key the page never sees. It cannot reach any other host, path, or provider.
- Kev itself binds to `127.0.0.1` and refuses to start without a key. The launcher generates a fresh key for each run.
- The public site never calls your computer. Only the page served by local RISE (marked with `<meta name="rise-local">`) looks for Kev.

## Network dependencies

- **First run:** npm packages, Python packages (PyPI, the PyTorch CUDA index, and the Kev archive on GitHub), and model weights from Hugging Face.
- **Every run:** none for decisions. The catalog is the static file the build publishes at `/content/catalog.json`. After the first successful load, later runs set `HF_HUB_OFFLINE=1`.
- **Still online:** Library texts, museum imagery, and other content sources that RISE reads from the web, exactly as on the public site.

Fully offline operation (catalog, assets, and inference with no network at all) has not yet been verified, so RISE does not claim it.

## Troubleshooting

- *"No supported GPU"*: `nvidia-smi` was not found or reported no GPU. Install the NVIDIA driver, or use hosted Jev with your own OpenRouter account.
- *"Only N MiB of system memory is free"*: close applications yourself and start again. RISE does not close anything for you.
- *Kev exited*: the terminal shows Kev's own error. Deleting the `venv` folder in the state folder forces a clean reinstall, and deleting `hf` forces the weights to download again.
