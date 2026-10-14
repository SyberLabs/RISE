/**
 * The room's third source (venue.js): a sealed Current already admitted on the page, a RISE Changes digest's
 * (src/app/changes.js). It is the MCP adapter's admitted path, as a card plays the Current its host handed over
 * (mcp-app.js `admittedEvents`), with no host behind it: the port delivers nothing and takes no question, so there
 * is no Dive, and the Current reads under its own origin, which the page admitted. It opens no request of any kind.
 */
import { createRealClock } from '../clock.js';
import { currentToEvents } from './current-events.js';
import { createMcpAppAdapter } from './mcp-app.js';

const NO_HOST = Object.freeze({ onCurrent: () => () => {}, canSample: () => false });

/** @throws {RiseCurrentError} when `current` is not a valid sealed Current */
export function createSealedAdapter({ current, clock = createRealClock() }) {
    const events = currentToEvents(current);
    return {
        ...createMcpAppAdapter({ port: NO_HOST, clock, admittedEvents: events, admittedCurrent: current, origin: events[0].body.origin }),
        id: 'sealed'
    };
}
