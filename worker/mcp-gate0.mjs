import { RISE_CURRENT_VISUALS } from '../src/core/rise-current.js';

/**
 * Gate 0 probe: does a voice host call a tool between spoken stages of ONE turn?
 *
 * One data-only tool, `rise_set_visual`. It has no UI resource on purpose: a
 * render tool makes the host mount a new widget per call, which would confound
 * the measurement. It changes nothing on screen. It validates its two arguments
 * against the closed catalog, and writes one log line with the server's receipt
 * time, so the gap between calls can be read with `wrangler tail`. The gaps are
 * the evidence: calls seconds apart, with speech heard between them, mean the
 * host interleaves; calls milliseconds apart mean they were batched.
 *
 * It holds nothing and logs no request text, only the visual and the intensity.
 * It is listed only when MCP_GATE0 is 'true', which only the demo config sets.
 * Delete this file and its two call sites once Gate 0 is recorded
 * (docs/adr/0002-gate-0-realtime-host.md).
 */

export const GATE0_TOOL_NAME = 'rise_set_visual';

export const GATE0_TOOL = Object.freeze({
  name: GATE0_TOOL_NAME,
  title: 'Change the RISE visual',
  description: `Change the visual behind the words while you are speaking. Use it to mark stages of a spoken explanation: say one stage aloud, then call ${GATE0_TOOL_NAME}, then say the next stage, then call it again. Do not make all the calls at once. "visual" is one of ${RISE_CURRENT_VISUALS.join(', ')}. "intensity" is a number from 0 to 1.`,
  inputSchema: {
    type: 'object',
    properties: {
      visual: { type: 'string', enum: [...RISE_CURRENT_VISUALS] },
      intensity: { type: 'number', minimum: 0, maximum: 1 }
    },
    required: ['visual', 'intensity'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
});

/** The tool's result for one call's arguments, and the line to log. `now` is milliseconds since the epoch. */
export function callGate0(args, now) {
  const visual = args?.visual;
  const intensity = args?.intensity;
  if (!RISE_CURRENT_VISUALS.includes(visual) || typeof intensity !== 'number' || !(intensity >= 0 && intensity <= 1)) {
    return {
      log: null,
      result: {
        content: [{ type: 'text', text: `Call ${GATE0_TOOL_NAME} with "visual" one of ${RISE_CURRENT_VISUALS.join(', ')} and "intensity" from 0 to 1.` }],
        isError: true
      }
    };
  }
  const receivedAt = new Date(now).toISOString();
  return {
    log: JSON.stringify({ gate0: 'TOOL_CALL', receivedAt, visual, intensity }),
    result: {
      content: [{ type: 'text', text: `RISE set the visual to ${visual} at intensity ${intensity}. Continue speaking.` }],
      structuredContent: { visual, intensity, receivedAt }
    }
  };
}
