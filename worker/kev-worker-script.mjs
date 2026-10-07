// The on-device Kev and embedding workers are the only documents allowed to
// fetch model hosts and compile WebAssembly. Dedicated workers are governed
// by the policy on their own scripts, so pages keep the site policy. Both
// scripts get this one policy: the Kev worker's runtime binary is bundled
// with the site, and cdn.jsdelivr.net is for the embedding worker's CPU
// runtime alone (ORT_WASM_CPU in embed-model.js), which it
// checks against a pinned digest.
export const KEV_WORKER_POLICY = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; "
    + 'connect-src https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net';

export function isKevWorkerScript(path) {
    return /^\/assets\/(?:kev|embed)-worker-[\w-]+\.js$/u.test(path);
}

/** Serve a model worker script with its own policy in place of the site's. */
export async function serveKevWorkerScript(request, env) {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('Content-Security-Policy', KEV_WORKER_POLICY);
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}
