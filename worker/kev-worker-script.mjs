// The on-device Kev worker is the only document allowed to fetch model hosts
// and compile WebAssembly. A dedicated worker is governed by the policy on its
// own script, so the pages that start it keep the site policy.
export const KEV_WORKER_POLICY = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; "
    + 'connect-src https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net';

export function isKevWorkerScript(path) {
    return /^\/assets\/kev-worker-[\w-]+\.js$/u.test(path);
}

/** Serve the Kev worker script from static assets with its own policy in place of the site's. */
export async function serveKevWorkerScript(request, env) {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('Content-Security-Policy', KEV_WORKER_POLICY);
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}
