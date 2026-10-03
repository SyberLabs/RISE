/**
 * A server-sent-events parser, for the stream Google sends back.
 *
 * Google's streaming answer is a sequence of events, each a block of `data:`
 * lines ended by a blank line (`alt=sse`). What arrives is cut anywhere, in
 * whatever line endings the server uses, and is never trusted: a line or an
 * event longer than its limit is dropped whole (and the parser goes on with the
 * next), so what is held is bounded whatever is fed. Nothing here reads the
 * JSON inside an event; that is the wire's business (gemini-wire.js).
 *
 *   const parser = createSseParser({ onData(text) { ... } });
 *   parser.feed(chunk); ... parser.end();
 *
 * One deliberate leniency: at the end of the stream a block whose lines were
 * complete but whose blank line never came is still handed over. The wire
 * parses it as JSON and refuses a cut-off one, so nothing half-received is
 * believed, and a server that forgets its final blank line loses nothing.
 */

export const SSE_LIMITS = Object.freeze({ line: 65_536, event: 131_072 });

/**
 * @param {object} options
 * @param {(data: string) => void} options.onData the data of one event
 * @param {number} [options.maxLine]
 * @param {number} [options.maxEvent]
 */
export function createSseParser({ onData, maxLine = SSE_LIMITS.line, maxEvent = SSE_LIMITS.event }) {
    let line = '';
    let skipping = false;
    let sawCarriageReturn = false;
    let started = false;
    let ended = false;
    let lines = [];
    let size = 0;
    let poisoned = false;

    function dispatch() {
        const complete = !poisoned && lines.length > 0;
        const data = complete ? lines.join('\n') : null;
        lines = [];
        size = 0;
        poisoned = false;
        if (data !== null) onData(data);
    }

    function endLine() {
        const text = line;
        const wasSkipping = skipping;
        line = '';
        skipping = false;
        // A line that was too long was lost, and an event that lost a line is not the event that was sent.
        if (wasSkipping) { poisoned = true; lines = []; return; }
        if (text === '') { dispatch(); return; }
        // A comment starts with a colon, so its field name is empty and is ignored with every other field.
        const colon = text.indexOf(':');
        const field = colon === -1 ? text : text.slice(0, colon);
        if (field !== 'data' || poisoned) return;
        let value = colon === -1 ? '' : text.slice(colon + 1);
        if (value[0] === ' ') value = value.slice(1);
        size += value.length + 1;
        if (size > maxEvent) { poisoned = true; lines = []; size = 0; return; }
        lines.push(value);
    }

    return {
        feed(chunk) {
            if (ended || typeof chunk !== 'string') return;
            let text = chunk;
            if (!started) {
                started = true;
                if (text[0] === '\uFEFF') text = text.slice(1);
            }
            for (let i = 0; i < text.length; i += 1) {
                const ch = text[i];
                if (sawCarriageReturn) {
                    sawCarriageReturn = false;
                    if (ch === '\n') continue;
                }
                if (ch === '\r' || ch === '\n') {
                    endLine();
                    sawCarriageReturn = ch === '\r';
                } else if (!skipping) {
                    line += ch;
                    if (line.length > maxLine) { skipping = true; line = ''; }
                }
            }
        },

        /** The stream is over. Whatever is whole is handed over; nothing is heard after this. */
        end() {
            if (ended) return;
            if (line !== '' || skipping) endLine();
            dispatch();
            ended = true;
        },

        /** How much is being held, in characters. */
        pending() {
            return line.length + size;
        }
    };
}
