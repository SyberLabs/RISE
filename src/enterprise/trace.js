/**
 * The room's event trace: append-only, bounded, and ordered.
 *
 * Every step of the live loop lands here — speech state, warming,
 * retrieval, candidate formation, the decision request and its answer, rail
 * changes, the promotion gate, and the stage. Events carry ids, counts,
 * scores, reasons, and latencies. They do not carry what anyone said: speech
 * events record a character count.
 */

export const TRACE_SCHEMA = 'rise.enterprise-trace.v1';

function percentile(sorted, fraction) {
    if (!sorted.length) return null;
    const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
    return sorted[Math.max(0, index)];
}

export function createTrace({ now = () => performance.now(), limit = 2_000, onEvent } = {}) {
    const events = [];
    let seq = 0;
    let dropped = 0;

    function emit(type, fields = {}) {
        seq += 1;
        const event = Object.freeze({ ...fields, seq, t: Math.round(now()), type });
        events.push(event);
        while (events.length > limit) {
            events.shift();
            dropped += 1;
        }
        if (typeof onEvent === 'function') {
            try {
                onEvent(event);
            } catch {
                // A sink failure is not a room failure.
            }
        }
        return event;
    }

    function summary() {
        const counts = {};
        const outcomes = {};
        const latencies = [];
        for (const event of events) {
            counts[event.type] = (counts[event.type] || 0) + 1;
            if (event.type === 'decision.response') {
                outcomes[event.outcome] = (outcomes[event.outcome] || 0) + 1;
                if (event.outcome === 'answered' && Number.isFinite(event.latencyMs)) {
                    latencies.push(event.latencyMs);
                }
            }
        }
        latencies.sort((a, b) => a - b);
        return {
            events: seq,
            dropped,
            counts,
            decisions: {
                outcomes,
                p50Ms: percentile(latencies, 0.5),
                p95Ms: percentile(latencies, 0.95)
            }
        };
    }

    return {
        emit,
        events: () => [...events],
        summary,
        toJSON: () => ({ schema: TRACE_SCHEMA, dropped, summary: summary(), events: [...events] })
    };
}
