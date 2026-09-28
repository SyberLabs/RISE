# Kev-4B deployment and RISE evaluation

This is a staging procedure. The committed files do not deploy a service, create a cloud resource, send reader data, or change production traffic. A warm GPU container incurs charges while deployed. Record the Modal rate and obtain deployment authorization before running the cloud commands below.

## Pinned service

`deploy/kev/modal_app.py` serves the upstream System One API on a Modal L40S with one warm container. Startup fails when the named Modal secret has no nonempty `KEV_API_KEY`. Kev's middleware then requires that bearer key on both `/v1/models` and `/v1/systemone`. The app uses the upstream warm-up requests and CUDA graph path; its web endpoint keeps the original request and answer shapes. After loading and validating the pinned checkpoint, the SyberLabs serving wrapper adds `X-Kev-Revision: 139fdd94f1b6a6ad80cc15e08fcb99cac885a101` to every `/v1/` response, including authentication failures. This is a custom serving attestation, not an upstream Kev API field. The Worker must require the exact header on each live Kev inference before accepting or caching the response.

| Component | Immutable revision | Evidence |
| --- | --- | --- |
| Kev serving code | `9c41005b2180347c3c646dfc9e50c4428483ec6b` | [Upstream serving recipe](https://github.com/jaredpalmer/kev/blob/9c41005b2180347c3c646dfc9e50c4428483ec6b/skills/kev-finetune/scripts/kev_modal.py), [license](https://github.com/jaredpalmer/kev/blob/9c41005b2180347c3c646dfc9e50c4428483ec6b/LICENSE) (Apache-2.0) |
| Kev-4B adapter and head | `139fdd94f1b6a6ad80cc15e08fcb99cac885a101` | [Pinned model tree](https://huggingface.co/jaredpalmer/kev-4b/tree/139fdd94f1b6a6ad80cc15e08fcb99cac885a101), [model card](https://huggingface.co/jaredpalmer/kev-4b) (Apache-2.0) |
| Qwen base weights | `1001bb4d826a52d1f399e183466143f4da7b741b` | [Pinned base tree](https://huggingface.co/Qwen/Qwen3.5-4B-Base/tree/1001bb4d826a52d1f399e183466143f4da7b741b), [base license](https://huggingface.co/Qwen/Qwen3.5-4B-Base/blob/1001bb4d826a52d1f399e183466143f4da7b741b/LICENSE) (Apache-2.0) |

The Kev checkpoint's [provenance.json](https://huggingface.co/jaredpalmer/kev-4b/blob/139fdd94f1b6a6ad80cc15e08fcb99cac885a101/provenance.json) records the full Qwen base revision above. The Kev loader uses `head.pt` metadata to request that base revision; `modal_app.py` checks it before loading the model. The Kev model API reports the pinned adapter run and base name, but it does **not** expose `base_revision`, so the smoke script checks what the API can attest and startup enforces the remaining pin. The Python package graph is resolved by the upstream package declaration at image build time; it is not a lockfile-reproduced environment. Preserve the built Modal image ID for any measured release and review dependency updates before rebuilding.

## Automated deploy

`.github/workflows/kev-deploy.yml` (Actions → **Deploy Kev** → Run workflow, from `main`) does the production path in one run. It needs repository secrets `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`, from a Modal workspace with billing enabled. The run:
1. Generates a fresh bearer key and writes it to the Modal Secret `rise-kev-api-key` in Modal environment `rise-kev`.
2. Deploys `modal_app.py` and waits for the warm container.
3. Runs `smoke.py`, which blocks the run on failure, and `probe.py`, which only reports.
4. Sets the production Worker secrets `KEV_API_KEY`, `KEV_BASE_URL` and `KEV_REVISION`.

Production traffic still stays on Jev until the repository variables `KEV_REVISION` and `KEV_PRODUCTION_VERIFIED=true` are set and a release runs. Re-running the workflow rotates the key, and requests to Kev fail between the Modal deploy and the Worker secret update. The manual staging procedure below remains the way to run the 39-case comparison.

## Stage and inspect

From the RISE repository root in PowerShell, use a local virtual environment for Modal. The Python path below is the Codex bundled runtime on this workstation; another host may use Python 3.12 or 3.13. These commands prepare the CLI only.

```powershell
$Py = 'C:\Users\scarl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $Py -m venv deploy/kev/.venv
& deploy/kev/.venv/Scripts/python.exe -m pip install 'modal==1.5.5'
$Modal = (Resolve-Path deploy/kev/.venv/Scripts/modal.exe).Path
& $Modal token new
& $Modal environment list
```

Use a dedicated non-production Modal environment, such as `rise-kev-staging` (create it once with `& $Modal environment create rise-kev-staging`). In that environment, create a Secret named `rise-kev-api-key` containing `KEV_API_KEY` with a strong, nonempty value. The [Modal Secrets panel](https://modal.com/secrets) avoids putting the value in a CLI argument. Verify the secret name is listed with `& $Modal secret list -e rise-kev-staging`; this does not prove the secret's value, which the container checks at startup.

After authorization for cloud spend, inspect the current [Modal GPU rate](https://modal.com/pricing) and deploy into staging:

```powershell
& $Modal deploy -e rise-kev-staging deploy/kev/modal_app.py
```

Record the deployed image ID, URL, deployment time, code SHA, adapter SHA, and base SHA. Keep the URL as an HTTPS origin, without `/v1` or a trailing path. The app is configured for `min_containers=1`, so the GPU stays allocated while deployed. Startup downloads the pinned model and base and warms the serving kernels before requests. If startup fails, use `& $Modal app logs -e rise-kev-staging rise-kev-pinned`; do not route RISE traffic to it.

## Synthetic smoke

Set the URL printed by Modal and the same bearer key stored in the Modal Secret. `smoke.py` sends only a synthetic support ticket. It checks missing and incorrect key rejection, authenticated `/v1/models` identity, the revision header on every `/v1/` response, and the choice and noul answer shapes. Its HTTP client refuses redirects so the bearer key cannot follow a redirect to another host or to HTTP. A failed check blocks traffic routing.

```powershell
$env:KEV_BASE_URL = 'https://<exact-url-printed-by-modal>'
$env:KEV_API_KEY = Read-Host 'Kev staging API key' -MaskInput
$env:KEV_MODEL = 'kev-latest'
$env:KEV_REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101'
& $Py deploy/kev/smoke.py
```

The Worker contract uses `DECISION_PROVIDER=kev` for the default path and `DECISION_PROVIDER=jev` for explicit rollback, plus `KEV_BASE_URL`, `KEV_API_KEY`, `KEV_MODEL`, and `KEV_REVISION`. Configure these only in the intended staging Worker environment after the smoke check. The Worker must construct `${KEV_BASE_URL}/v1/systemone`, keep the key server side, bound requests to the intended HTTPS origin, and normalize Kev's `{model, answers, usage, latency_ms}` response for its decision validator. The current Jev response also has an `id` and `provider`; Kev's native response does not. Keep the existing allowed-choice and fallback validation as the routing changes. Switching a Worker is a separate deployment action; this procedure makes no production change.

## Local Windows GPU

`deploy/kev/local_app.py` serves the same pinned checkpoint on this PC's NVIDIA GPU with no cloud service. It uses upstream `kev.serve` in one process on `http://127.0.0.1:8009` only. There is no LAN binding, port forward or tunnel. Startup keeps the Modal wrapper's rules: it needs a nonempty `KEV_API_KEY` before `kev.serve` is imported, checks the run, base and base revision before loading, warms up on synthetic requests, and only then adds `X-Kev-Revision` to every `/v1/` response. It stops instead of falling back to the CPU, another checkpoint or hosted inference. The first qualification configuration is bf16 PyTorch with CUDA graphs off, fused kernels off, backend `torch`, and the prefix cache off (`KEV_PREFIX_CACHE=0`). Change it only after a measured failure, then rerun acceptance.

From the RISE repository root in PowerShell:

```powershell
.\deploy\kev\local.ps1 setup -Python <path to a Python 3.12 python.exe>   # once: venv, torch 2.8.0+cu128, kev[serve] at the pin, CUDA check
.\deploy\kev\local.ps1 start   # loads the model and serves; Ctrl+C stops it
.\deploy\kev\local.ps1 smoke   # in a second window: smoke.py and probe.py against 127.0.0.1:8009
```

The venv, Hugging Face cache, `pip freeze` inventory and bearer key live in `%LOCALAPPDATA%\rise-kev`, outside the repository. The launcher generates the key once, restricts the file to the current user, and passes it only through the child process environment. `smoke.py` and `probe.py` accept plain HTTP only with `--allow-loopback`, and then only `http://127.0.0.1:<port>` with no credentials, path, query or fragment. Requests to that origin skip configured HTTP proxies and never follow redirects. Without the flag they stay HTTPS-only, and the Worker's provider validation is unchanged. A passing local smoke shows the model loads and answers. It does not show that full RISE requests meet the 8,000 ms gate below.

## Evaluation gates before routing

Run the repository's fixed Worker cases first. These tests exercise menu bounds, active catalog filtering, schema versions, invalid provider choices, cache behavior, and reading configuration mapping; provider responses there are mocked, so passing them establishes integration behavior only.

```powershell
npm run test:run -- worker/jev-recommend.test.js worker/jev-variance.test.js worker/kev-migration.test.js
```

Then run the predeclared synthetic intent probes. Their intent strings come from `worker/jev-recommend.test.js`: piano, no motion, large text, psychedelic, reflective, and silent finale. `probe.py` prints each observed choice and wall time and exits unsuccessfully if any explicit constraint is missed. The expectations are reader constraints for review, not measured Kev successes or statistically representative accuracy. The reduced probes do not contain the Worker's full book and presentation menu.

```powershell
& $Py deploy/kev/probe.py
```

For the actual RISE decision route, use `staging-eval.mjs`. It sends the repository's [39 fixed synthetic cases](../scripts/jev-eval-cases.json) through a **non-production staging Worker** and scores the [current offered-choice snapshot](../scripts/jev-eval-options-candidate.json) with the existing `scoreDecisions` scorer. The runner rejects the production host and redirects, requires an explicit HTTPS staging origin, limits each capture to 16 calls for the Worker rate limit, and writes only case IDs, decisions, provider/model/revision identity, cache status, and wall time through full response-body parsing. It omits raw intents, secrets, and request IDs. Use a separate staging Redis namespace so the captures are uncached. Set the staging Worker to `DECISION_PROVIDER=jev` for the baseline and then to `DECISION_PROVIDER=kev` for the candidate; these are deliberate staging configuration changes outside this script.

```powershell
$Node = 'C:\Users\scarl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$Stage = 'https://<explicit-nonproduction-preview>.workers.dev'
$Cases = 'scripts/jev-eval-cases.json'
$Options = 'scripts/jev-eval-options-candidate.json'
$Eval = 'deploy/kev/staging-eval.mjs'
# Run these three commands while the staging Worker is configured for Jev.
& $Node $Eval capture --origin $Stage --provider jev --cases $Cases --options $Options --start 0 --count 13 --output jev-staging.json
Start-Sleep -Seconds 65 # Stay below the staging Worker's 30 requests per 60 seconds per IP.
& $Node $Eval capture --origin $Stage --provider jev --cases $Cases --options $Options --start 13 --count 13 --output jev-staging.json
Start-Sleep -Seconds 65
& $Node $Eval capture --origin $Stage --provider jev --cases $Cases --options $Options --start 26 --count 13 --output jev-staging.json
# After configuring that same staging Worker for the pinned Kev deployment:
Start-Sleep -Seconds 65
& $Node $Eval capture --origin $Stage --provider kev --cases $Cases --options $Options --start 0 --count 13 --output kev-staging.json
Start-Sleep -Seconds 65
& $Node $Eval capture --origin $Stage --provider kev --cases $Cases --options $Options --start 13 --count 13 --output kev-staging.json
Start-Sleep -Seconds 65
& $Node $Eval capture --origin $Stage --provider kev --cases $Cases --options $Options --start 26 --count 13 --output kev-staging.json
& $Node $Eval compare --cases $Cases --options $Options --baseline jev-staging.json --candidate kev-staging.json
```

**Automated run.** Actions → **Kev staging evaluation** (`.github/workflows/kev-staging-eval.yml`, from `main`) runs the same captures and comparison against the Access-protected staging Worker. It needs the staging environment secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (a Cloudflare Access service token that the staging app's policy admits) and the staging Worker secret `KEV_API_KEY`. Each run deploys the tested commit to staging with `DECISION_CACHE_NAMESPACE` set to a value unique to the run. That value is signed into every decision and variation key, so both providers start from empty state and production's cache is never read or written. With it unset, keys are byte-for-byte what they were before the variable existed. The job summary shows the gates, both scores, Kev's p50/p95/max full-request time, and any rows that were not accepted; the sanitized captures are kept as a run artifact.

The comparison fails without a complete measured Jev baseline identity and the exact Kev revision. Its gates require 39 valid accepted decisions, zero out-of-menu values, explicit preference matches and contrast pairs at least as good as the Jev baseline, and every Kev request within the Worker's existing 8-second provider deadline. A cached decision is excluded because it would hide provider latency. The baseline's Jev model string is the only identity its route exposes; it is not an immutable Jev weights SHA. The live full-request accuracy and latency result remains **unverified** until both captures and the comparison complete. Preserve the two sanitized captures and comparison output for review before any traffic switch.

The fixed cases also do not establish privacy approval for real reading data. Keep staging evaluation synthetic until that separate authorization is in place. If Kev fails a gate, leave the Worker on `DECISION_PROVIDER=jev` and retain the failed observations for diagnosis.

## Production release gate

Merging this migration does not switch production to Kev and does not pause releases. Every push to main still deploys RISE. Until the repository variable `KEV_PRODUCTION_VERIFIED=true`, the production job deploys the Worker with `DECISION_PROVIDER=jev` (the explicit rollback, using the existing `OPENROUTER_API_KEY`) and verifies Jev identity after deploy. `wrangler.production.jsonc` also defaults to Jev, so a manual deploy cannot select Kev by accident.

Leave the variable unset until the authenticated warm host, Worker secrets, privacy review, and live baseline comparison above are complete. Then:

1. Set the production Worker secrets `KEV_API_KEY`, `KEV_BASE_URL`, and `KEV_REVISION` (`wrangler secret put <NAME> --config wrangler.production.jsonc`).
2. Set repository variables `KEV_REVISION` (the same 40-character revision), optionally `KEV_MODEL=kev-latest`, and `KEV_PRODUCTION_VERIFIED=true`.
3. Push a reviewed release commit to main; workflow_dispatch runs validation only.

With the gate enabled, the job selects `vars.DECISION_PROVIDER` (default `kev`), refuses to deploy when any Kev Worker secret is missing, and after deploy requires both response versions to identify `Kev`, `kev-latest`, and that exact revision. To roll back, clear `KEV_PRODUCTION_VERIFIED` (or set `DECISION_PROVIDER=jev`) and push or re-run the release; the checks then require the Jev model family.
