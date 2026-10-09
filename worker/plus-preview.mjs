import { WorkerEntrypoint } from 'cloudflare:workers';
import worker from './index.mjs';
import { renderVoice, providerReadiness } from './plus-provider.mjs';
export { PlusMeter } from './index.mjs';

/** A named service binding is the only way to invoke this billable capability. */
export class VoiceProvider extends WorkerEntrypoint {
  ready(input) { return providerReadiness(input, this.env); }
  render(input) { return renderVoice(input, this.env); }
  fetch() { return new Response(null, { status: 403 }); }
}

export default {
  fetch(request, env, ctx) {
    // Test payments must never spend the key held here outside production's real-revenue meter.
    if (new URL(request.url).pathname === '/api/plus/voice') return new Response(null, { status: 403 });
    return worker.fetch(request, env, ctx);
  }
};
