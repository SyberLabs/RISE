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

edit('src/core/reading-score.js', [
[`import { resolveSourceSpan, buildNormalizedSourceIndex } from './source-span.js';`,
 `import { restoreLiteral } from './chunker.js';
import { resolveSourceSpan, buildNormalizedSourceIndex } from './source-span.js';`],
[`  const text = typeof source?.raw === 'string' ? source.raw : '';
  const defaultMode`, `  // A literal source is held escaped; a quotation is of what the author wrote, and the two are the same length.
  const held = typeof source?.raw === 'string' ? source.raw : '';
  const text = source?.literal === true ? restoreLiteral(held) : held;
  const defaultMode`]
]);

edit('src/core/rise-current.js', [
[`import { SOURCE_MARKER, SOURCE_SCORE_CUT } from './chunker.js';`,
 `import { hasLiteralForbidden, SOURCE_MARKER, SOURCE_SCORE_CUT } from './chunker.js';`],
[`    keys(segment, ['id', 'text', 'visual', 'dives'], path);`, `    keys(segment, ['id', 'text', 'visual', 'dives', 'literal'], path);
    if (segment.literal !== undefined && typeof segment.literal !== 'boolean') {
      fail('CURRENT_LITERAL', \`\${path}.literal\`, 'literal is true or false');
    }
    const literal = segment.literal === true;`],
[`    if (hasReservedMarker(text)) {
      fail('CURRENT_RESERVED_TEXT', \`\${path}.text\`, 'Text contains a reserved playback marker');
    }`, `    // A literal segment says its bars and bracketed words are words; it still cannot carry the score cut
    // or the stand-ins that escape it, which are never text.
    if (literal ? hasLiteralForbidden(text) : hasReservedMarker(text)) {
      fail('CURRENT_RESERVED_TEXT', \`\${path}.text\`, literal
        ? 'Literal text cannot contain the score cut or the stand-ins that escape it'
        : 'Text contains a reserved playback marker');
    }`],
[`    return { id: segmentId, text, visual, dives };`, `    return { id: segmentId, text, visual, dives, ...(literal ? { literal: true } : {}) };`],
[`      providerId: current.origin.kind === 'model' ? current.origin.provider : 'local',
      provenance: { origin: current.origin, currentId: current.id },
      data: segment.text
    })),`, `      providerId: current.origin.kind === 'model' ? current.origin.provider : 'local',
      provenance: { origin: current.origin, currentId: current.id },
      data: segment.text,
      ...(segment.literal ? { literal: true } : {})
    })),`]
]);
