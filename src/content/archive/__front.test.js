import { describe, it } from 'vitest';
import { ingestedArchiveTexts } from './index.js';
import { scanLine } from './defect-signatures.js';
import { isContentsPage } from './divisions.js';

const DISTRIBUTOR = /gutenberg|ebook|transcriber|produced by|proofread|scanned|archive\.org|copyright|all rights reserved|printed in|publisher/i;

describe('probe', () => {
    it('which leading front matter is the distributor and which is the author', async () => {
        const works = ingestedArchiveTexts();
        const rows = [];
        for (const w of works) {
            const d = typeof w.getDivisions === 'function' ? await w.getDivisions() : null;
            const entries = Array.isArray(d?.entries) ? d.entries : [];
            const lead = entries.filter(e => /^front matter/i.test(String(e.label || '')));
            if (!lead.length) continue;
            const text = lead.map(e => e.content || '').join('\n\n');
            const sigs = new Set();
            for (const line of text.split('\n')) for (const s of scanLine(line)) sigs.add(s.id ?? String(s));
            const hits = (text.match(DISTRIBUTOR) || []).length;
            const density = (text.match(new RegExp(DISTRIBUTOR.source, 'gi')) || []).length;
            rows.push({
                id: w.id, divisions: lead.length, words: lead.reduce((n, e) => n + (e.words || 0), 0),
                sigs: [...sigs], density, contents: isContentsPage(text, d?.noun || 'Chapter'),
                head: text.replace(/\s+/g, ' ').slice(0, 90)
            });
        }
        rows.sort((a, b) => b.density - a.density);
        console.log(`works with leading Front matter: ${rows.length}\n`);
        for (const r of rows) {
            console.log(`${String(r.density).padStart(3)} hits ${String(r.words).padStart(6)}w ${r.contents ? 'CONTENTS' : '        '} ${r.sigs.length ? '[' + r.sigs.join(',') + ']' : ''} ${r.id}`);
            console.log(`             ${r.head}`);
        }
    }, 600000);
});
