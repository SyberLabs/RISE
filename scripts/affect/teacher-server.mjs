/**
 * Serves precomputed local-teacher ratings on the contract the
 * benchmark already calls: POST JSON { id, text } → JSON dimensions.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const document = JSON.parse(readFileSync(new URL('../../docs/affect/teacher-scores.json', import.meta.url), 'utf8'));
const byId = new Map(document.passages.map(row => [row.id, row]));
const port = Number(process.env.AFFECT_TEACHER_PORT || 8765);

const server = createServer((request, response) => {
    if (request.method !== 'POST') {
        response.writeHead(405);
        response.end();
        return;
    }
    let body = '';
    request.on('data', chunk => {
        body += chunk;
    });
    request.on('end', () => {
        let id = '';
        try {
            id = JSON.parse(body).id;
        } catch {
            id = '';
        }
        const row = byId.get(id);
        response.writeHead(200, { 'content-type': 'application/json' });
        if (!row || Object.keys(row.dimensions || {}).length === 0) {
            response.end(JSON.stringify({ error: 'unparsed', modelId: document.modelId }));
            return;
        }
        response.end(JSON.stringify({
            modelId: document.modelId,
            parameters: document.parameters,
            note: document.note,
            ms: row.ms,
            dimensions: row.dimensions
        }));
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log(`teacher http://127.0.0.1:${port}`);
});
