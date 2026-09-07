#!/usr/bin/env node

/**
 * Publish the Privacy Policy and Terms as pages a reader can actually open.
 *
 * A policy that lives only as Markdown in a repository is not published. The
 * California Online Privacy Protection Act asks for a privacy policy that is
 * *conspicuously posted*, and a reader with a question about their data should
 * not be asked to find GitHub.
 *
 * MARKDOWN IS AUTHORED ONCE, IN THE REPOSITORY. These pages are a view of
 * PRIVACY.md and TERMS.md, never a second copy to keep in step — the same rule
 * the wiki follows. Edit the Markdown; run this.
 *
 * No Markdown library is installed and none is added for two documents whose
 * every construct is known: headings, paragraphs, emphasis, code spans, links,
 * lists, tables, block quotes and rules. A dependency has to earn its place,
 * and eighty lines of converter is cheaper than a supply chain.
 *
 *   node scripts/build-legal.mjs           write public/privacy.html, terms.html
 *   node scripts/build-legal.mjs --check   fail if either is stale
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const DOCUMENTS = [
    { source: 'PRIVACY.md', out: 'privacy.html', title: 'Privacy Policy' },
    { source: 'TERMS.md', out: 'terms.html', title: 'Terms of Use' }
];

const escapeHtml = (text) => text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');

/** Emphasis, code, links. Applied to already-escaped text. */
function inline(text) {
    return text
        .replace(/`([^`]+)`/gu, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_, label, href) =>
            `<a href="${href}">${label}</a>`)
        // Bare <https://…>, which the escape pass turned into &lt;https…&gt;.
        .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/gu, '<a href="$1">$1</a>')
        .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*]+)\*/gu, '$1<em>$2</em>');
}

const cell = (row) => row.replace(/^\||\|$/gu, '').split('|').map(part => part.trim());

function toHtml(markdown) {
    // CRLF FIRST, OR NOTHING ELSE WORKS. This repository is checked out with
    // `core.autocrlf`, so on Windows every line arrives ending in \r. A
    // carriage return is a line terminator, which `.` and `$` will not cross,
    // so `# Heading\r` matched no heading rule and every heading in both
    // documents silently became a paragraph reading "# Heading".
    const lines = markdown.replace(/\r\n?/gu, '\n').split('\n');
    const out = [];
    let index = 0;

    const flushParagraph = (buffer) => {
        if (buffer.length) out.push(`<p>${inline(escapeHtml(buffer.join(' ')))}</p>`);
        buffer.length = 0;
    };

    const paragraph = [];
    while (index < lines.length) {
        const line = lines[index];

        if (!line.trim()) { flushParagraph(paragraph); index += 1; continue; }

        const heading = line.match(/^(#{1,4})\s+(.*)$/u);
        if (heading) {
            flushParagraph(paragraph);
            const level = heading[1].length;
            out.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
            index += 1;
            continue;
        }

        if (/^---+\s*$/u.test(line)) {
            flushParagraph(paragraph);
            out.push('<hr>');
            index += 1;
            continue;
        }

        // Table: a header row, an alignment row, then body rows.
        if (line.startsWith('|') && /^\|[\s:|-]+\|$/u.test(lines[index + 1] || '')) {
            flushParagraph(paragraph);
            const head = cell(line);
            index += 2;
            const body = [];
            while (index < lines.length && lines[index].startsWith('|')) {
                body.push(cell(lines[index]));
                index += 1;
            }
            out.push(`<div class="table-scroll"><table><thead><tr>${
                head.map(text => `<th>${inline(escapeHtml(text))}</th>`).join('')
            }</tr></thead><tbody>${
                body.map(row => `<tr>${
                    row.map(text => `<td>${inline(escapeHtml(text))}</td>`).join('')
                }</tr>`).join('')
            }</tbody></table></div>`);
            continue;
        }

        if (/^[-*]\s+/u.test(line)) {
            flushParagraph(paragraph);
            const items = [];
            while (index < lines.length && (/^[-*]\s+/u.test(lines[index])
                || (items.length && /^\s{2,}\S/u.test(lines[index])))) {
                if (/^[-*]\s+/u.test(lines[index])) items.push(lines[index].replace(/^[-*]\s+/u, ''));
                else items[items.length - 1] += ` ${lines[index].trim()}`;
                index += 1;
            }
            out.push(`<ul>${items.map(item => `<li>${inline(escapeHtml(item))}</li>`).join('')}</ul>`);
            continue;
        }

        if (line.startsWith('>')) {
            flushParagraph(paragraph);
            const quoted = [];
            while (index < lines.length && lines[index].startsWith('>')) {
                quoted.push(lines[index].replace(/^>\s?/u, ''));
                index += 1;
            }
            out.push(`<blockquote>${inline(escapeHtml(quoted.join(' ')))}</blockquote>`);
            continue;
        }

        paragraph.push(line.trim());
        index += 1;
    }
    flushParagraph(paragraph);
    return out.join('\n');
}

function page(title, body) {
    return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — RISE</title>
  <meta name="description" content="${title} for RISE, by SyberLabs.">
  <!-- Generated by scripts/build-legal.mjs from the Markdown in the repository.
       Do not edit this file; edit the Markdown and regenerate. -->
  <link rel="stylesheet" href="/fonts/fonts.css">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <style>
    :root {
      --void: #0a0a0c;
      --light: #e8e8ec;
      --cloud: #c5c5cd;
      --fog: #9b9ba5;
      --mist: #6b6b75;
      --shadow: #2a2a30;
      --accent: #57a46e;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--void);
      color: var(--cloud);
      font: 400 16px/1.7 'Crimson Pro', Georgia, serif;
      padding: clamp(24px, 6vw, 72px) clamp(20px, 6vw, 40px) 96px;
      -webkit-font-smoothing: antialiased;
    }

    main { max-width: 46rem; margin: 0 auto; }

    a { color: var(--accent); text-underline-offset: 3px; }
    a:hover { color: var(--light); }

    .back {
      display: inline-block;
      margin-bottom: clamp(28px, 5vw, 48px);
      color: var(--fog);
      font: 11px 'JetBrains Mono', monospace;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-decoration: none;
    }
    .back:hover { color: var(--light); }

    h1 {
      margin-bottom: 8px;
      font: 300 clamp(30px, 6vw, 46px)/1.1 'Marcellus', Georgia, serif;
      color: var(--light);
    }

    h2 {
      margin: 44px 0 14px;
      font: 300 clamp(20px, 3.4vw, 26px)/1.25 'Marcellus', Georgia, serif;
      color: var(--light);
    }

    h3 {
      margin: 28px 0 10px;
      font: 500 13px 'JetBrains Mono', monospace;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
    }

    p { margin: 0 0 16px; }
    strong { color: var(--light); font-weight: 600; }

    ul { margin: 0 0 18px; padding-left: 22px; }
    li { margin-bottom: 8px; }

    hr { margin: 40px 0; border: 0; border-top: 1px solid var(--shadow); }

    code {
      padding: 1px 5px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      font: 13px 'JetBrains Mono', monospace;
      color: var(--fog);
    }

    blockquote {
      margin: 0 0 24px;
      padding: 14px 18px;
      border-left: 2px solid var(--accent);
      background: rgba(87, 164, 110, 0.07);
      color: var(--fog);
      font-size: 15px;
    }

    .table-scroll { overflow-x: auto; margin: 0 0 22px; }

    table { width: 100%; border-collapse: collapse; font-size: 14px; }

    th, td {
      padding: 9px 12px;
      border-bottom: 1px solid var(--shadow);
      text-align: left;
      vertical-align: top;
    }

    th {
      font: 500 11px 'JetBrains Mono', monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--fog);
    }

    footer {
      margin-top: 64px;
      padding-top: 20px;
      border-top: 1px solid var(--shadow);
      color: var(--mist);
      font: 12px 'JetBrains Mono', monospace;
    }

    footer a { color: var(--mist); }
  </style>
</head>

<body>
  <main>
    <a class="back" href="/">← RISE</a>
${body.split('\n').map(line => `    ${line}`).join('\n')}
    <footer>
      <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> ·
      <a href="/">RISE</a>
    </footer>
  </main>
</body>

</html>
`;
}

const check = process.argv.includes('--check');
const problems = [];

for (const document of DOCUMENTS) {
    const markdown = readFileSync(join(ROOT, document.source), 'utf8');
    const html = page(document.title, toHtml(markdown));
    const target = join(ROOT, 'public', document.out);

    if (check) {
        // Line endings are git's business: `core.autocrlf` makes a committed
        // LF file CRLF on disk, and comparing raw bytes fails on that alone.
        const normalise = (text) => text.replace(/\r\n?/gu, '\n');
        const onDisk = existsSync(target)
            ? normalise(readFileSync(target, 'utf8'))
            : null;
        if (onDisk !== normalise(html)) {
            problems.push(`public/${document.out} is not what ${document.source} produces`);
        }
        continue;
    }
    writeFileSync(target, html);
    process.stderr.write(`✓ ${document.source} → public/${document.out}\n`);
}

if (check) {
    if (problems.length) {
        process.stderr.write(`\n✗ ${problems.join('\n✗ ')}\n\nRun: npm run build:legal\n`);
        process.exit(1);
    }
    process.stderr.write('✓ published policy pages match their Markdown\n');
}
