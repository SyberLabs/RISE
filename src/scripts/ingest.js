/**
 * ArXiv Ingestion Script
 * 
 * Fetches real research papers from ArXiv API and saves them to a local JSON file.
 * Run this script to populate the R.I.S.E. library with real scientific data.
 * 
 * Usage: node src/scripts/ingest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../sources/text/data/arxiv_cache.json');
const OUTPUT_DIR = path.dirname(OUTPUT_FILE);

// Categories to fetch
const CATEGORIES = {
    'quant-ph': 'Quantum Physics',
    'cs.AI': 'Artificial Intelligence',
    'gr-qc': 'General Relativity',
    'q-bio.NC': 'Neuroscience',
    'cs.CY': 'Computers & Society'
};

const MAX_RESULTS = 20;

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchCategory(catCode) {
    console.log(`Fetching ${CATEGORIES[catCode]} (${catCode})...`);
    const url = `https://export.arxiv.org/api/query?search_query=cat:${catCode}&start=0&max_results=${MAX_RESULTS}&sortBy=submittedDate&sortOrder=descending`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`API responded with status code ${res.statusCode}`));
                res.resume(); // consume response data to free up memory
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parseAtom(xmlText) {
    // Simple regex parsing to avoid heavy XML dependencies for this script
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xmlText)) !== null) {
        const content = match[1];

        try {
            const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(content);
            const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(content);
            const publishedMatch = /<published>([\s\S]*?)<\/published>/.exec(content);
            const idMatch = /<id>([\s\S]*?)<\/id>/.exec(content);

            if (!titleMatch || !summaryMatch || !publishedMatch || !idMatch) continue;

            const title = titleMatch[1].replace(/\n/g, ' ').trim();
            const summary = summaryMatch[1].replace(/\n/g, ' ').trim();
            const published = publishedMatch[1].trim();
            const id = idMatch[1].trim();

            // Authors
            const authors = [];
            const authorRegex = /<name>([\s\S]*?)<\/name>/g;
            let authorMatch;
            while ((authorMatch = authorRegex.exec(content)) !== null) {
                authors.push(authorMatch[1]);
            }

            entries.push({
                id,
                title,
                summary,
                published,
                authors: authors.slice(0, 3).join(', ') // Top 3 authors
            });
        } catch (e) {
            console.warn('Skipped malformed entry');
        }
    }
    return entries;
}

async function main() {
    const cache = {};

    for (const [code, name] of Object.entries(CATEGORIES)) {
        try {
            const xml = await fetchCategory(code);
            const papers = parseAtom(xml);

            cache[code] = papers.map(p => ({
                id: p.id,
                type: 'text',
                name: p.title,
                content: `TITLE: ${p.title}\n\nAUTHORS: ${p.authors}\nDATE: ${p.published}\n\nABSTRACT:\n${p.summary}`,
                providerId: 'arxiv-research',
                metadata: {
                    author: p.authors,
                    date: new Date(p.published).toLocaleDateString(),
                    url: p.id,
                    abstract: p.summary,
                    isAbstract: true
                }
            }));

            console.log(`✓ Fetched ${papers.length} papers for ${name}`);
        } catch (err) {
            console.error(`✗ Failed ${name}:`, err.message);
            cache[code] = [];
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
    console.log(`\nSuccess! Saved ${Object.values(cache).flat().length} papers to:\n${OUTPUT_FILE}`);
}

main();
