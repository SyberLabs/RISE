import fs from 'node:fs';

function edit(p, pairs) {
    let s = fs.readFileSync(p, 'utf8');
    const crlf = s.includes('\r\n');
    s = s.replace(/\r\n/g, '\n');
    for (const [a, b] of pairs) {
        if (s.split(a).length !== 2) throw new Error(`not found exactly once: ${p}: ${a.slice(0, 80)}`);
        s = s.replace(a, () => b);
    }
    if (crlf) s = s.replace(/\n/g, '\r\n');
    fs.writeFileSync(p, s);
}

edit('src/live/protocol.js', [
[`    hasReservedMarker`, `    hasLiteralForbidden,
    hasReservedMarker`],
[`function chunk(value, path) {
    const clean = text(value, EVENT_LIMITS.textChunk, path);
    if (hasReservedMarker(clean)) {
        fail('EVENT_RESERVED_TEXT', path, 'Text contains a reserved playback marker');
    }
    return clean;
}`, `/** \`literal\` is optional and only ever \`true\`: an event does not say a thing is not literal. */
function literalFlag(e, p) {
    if (!Object.hasOwn(e, 'literal') || e.literal === undefined) return {};
    if (typeof e.literal !== 'boolean') fail('EVENT_LITERAL', \`\${p}.literal\`, 'literal is true or false');
    return e.literal ? { literal: true } : {};
}

function chunk(value, path, literal = false) {
    const clean = text(value, EVENT_LIMITS.textChunk, path);
    // A literal chunk's bars and bracketed words are words; the score cut and the stand-ins that
    // escape them are never text.
    if (literal ? hasLiteralForbidden(clean) : hasReservedMarker(clean)) {
        fail('EVENT_RESERVED_TEXT', path, literal
            ? 'Literal text cannot contain the score cut or the stand-ins that escape it'
            : 'Text contains a reserved playback marker');
    }
    return clean;
}`],
[`    'segment.begin': {
        fields: ['segmentId', 'visual'],
        read: (e, p) => {
            const clean = { segmentId: id(e.segmentId, \`\${p}.segmentId\`) };`, `    'segment.begin': {
        fields: ['segmentId', 'visual', 'literal'],
        read: (e, p) => {
            const clean = { segmentId: id(e.segmentId, \`\${p}.segmentId\`), ...literalFlag(e, p) };`],
[`    'segment.text': {
        fields: ['segmentId', 'offset', 'text'],
        read: (e, p) => ({
            segmentId: id(e.segmentId, \`\${p}.segmentId\`),
            offset: count(e.offset, RISE_CURRENT_LIMITS.segmentText, \`\${p}.offset\`, 'EVENT_OFFSET'),
            text: chunk(e.text, \`\${p}.text\`)
        })
    },`, `    'segment.text': {
        fields: ['segmentId', 'offset', 'text', 'literal'],
        read: (e, p) => {
            const literal = literalFlag(e, p);
            return {
                segmentId: id(e.segmentId, \`\${p}.segmentId\`),
                offset: count(e.offset, RISE_CURRENT_LIMITS.segmentText, \`\${p}.offset\`, 'EVENT_OFFSET'),
                text: chunk(e.text, \`\${p}.text\`, literal.literal === true),
                ...literal
            };
        }
    },`]
]);

edit('src/live/stream.js', [
[`    RISE_CURRENT_SCHEMA,
    hasReservedMarker,`, `    RISE_CURRENT_SCHEMA,
    hasLiteralForbidden,
    hasReservedMarker,`],
[`                if (event.visual !== undefined) segment.visual = event.visual;`, `                if (event.visual !== undefined) segment.visual = event.visual;
                if (event.literal === true) segment.literal = true;`],
[`                const segment = segmentFor(event.segmentId);
                if (segment.ended) refuse('SEGMENT_CLOSED', \`Segment \${segment.id} has ended\`);
                if (event.offset !== segment.text.length) {`, `                const segment = segmentFor(event.segmentId);
                if (segment.ended) refuse('SEGMENT_CLOSED', \`Segment \${segment.id} has ended\`);
                // Whether words are literal is decided once, when the segment begins, and every chunk agrees.
                if ((event.literal === true) !== (segment.literal === true)) {
                    refuse('LITERAL_MISMATCH', 'A chunk must be literal exactly when its segment is');
                }
                if (event.offset !== segment.text.length) {`],
[`                if (hasReservedMarker(joined)) refuse('RESERVED_TEXT', 'The text contains a reserved playback marker');`, `                if (segment.literal ? hasLiteralForbidden(joined) : hasReservedMarker(joined)) {
                    refuse('RESERVED_TEXT', 'The text contains a reserved playback marker');
                }`],
[`                    visual: segment.visual,
                    state: { ...segment.state },`, `                    visual: segment.visual,
                    ...(segment.literal ? { literal: true } : {}),
                    state: { ...segment.state },`],
[`                    ...(segment.visual === undefined ? {} : { visual: segment.visual }),
                    dives:`, `                    ...(segment.visual === undefined ? {} : { visual: segment.visual }),
                    ...(segment.literal ? { literal: true } : {}),
                    dives:`]
]);

edit('src/live/adapters/current-events.js', [
[`        events.push({ type: 'segment.begin', body: { segmentId: segment.id, visual: segment.visual } });`, `        const literal = segment.literal ? { literal: true } : {};
        events.push({ type: 'segment.begin', body: { segmentId: segment.id, visual: segment.visual, ...literal } });`],
[`            events.push({ type: 'segment.text', body: { segmentId: segment.id, offset, text: segment.text.slice(offset, end) } });`, `            events.push({ type: 'segment.text', body: { segmentId: segment.id, offset, text: segment.text.slice(offset, end), ...literal } });`]
]);
