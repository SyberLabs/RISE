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
 * Also publish the four linked source documents verbatim. Keeping them only
 * at the repository root makes their public URLs return the app's fallback.
 *
 *   node scripts/build-legal.mjs           write public pages and source documents
 *   node scripts/build-legal.mjs --check   fail if any published document is stale
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const DOCUMENTS = [
    { source: 'PRIVACY.md', out: 'privacy.html', title: 'Privacy Policy' },
    { source: 'TERMS.md', out: 'terms.html', title: 'Terms of Use' },
    { source: 'APPS.md', out: 'apps.html', title: 'RISE in ChatGPT and Claude' }
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
            // The scroller is focusable so a keyboard can scroll a wide table.
            out.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="Table: ${
                escapeHtml(head.join(', ')).replace(/"/gu, '&quot;')
            }"><table><thead><tr>${
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

/**
 * The page is the SyberLabs system (SPEC v1), written out because these files
 * are served as-is, outside the app bundle and its design-system.css. Values
 * are the tokens; fonts are the self-hosted faces in /fonts/fonts.css.
 */
const ARROW_LEFT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path></svg>';

function page(title, body) {
    return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — RISE</title>
  <meta name="description" content="${title} for RISE, by SyberLabs.">
  <meta name="color-scheme" content="dark">
  <!-- Generated by scripts/build-legal.mjs from the Markdown in the repository.
       Do not edit this file; edit the Markdown and regenerate. -->
  <link rel="stylesheet" href="/fonts/fonts.css">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <style>
    :root {
      /* SyberLabs Design System v2 ("Atlas") tokens. */
      --bg: #06051A;
      --surface: #0C0A2A;
      --line: rgba(170, 180, 255, 0.16);
      --text: #EEF0FF;
      --text-2: #B4BBE2;
      --text-3: #8990BB;
      --brand: #4890F0;
      --ice: #90D8F0;
      --sans: 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
      --serif: 'Instrument Serif', Georgia, 'Times New Roman', serif;
      --mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
      --gutter: clamp(16px, 4vw, 56px);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text-2);
      font: 400 16px/24px var(--sans);
      -webkit-font-smoothing: antialiased;
    }

    a { color: var(--text); text-decoration: none; }
    a:hover { color: var(--ice); }
    main a { text-decoration: underline; text-decoration-color: var(--ice); text-decoration-thickness: 1px; text-underline-offset: 5px; }

    a:focus-visible,
    [tabindex]:focus-visible {
      outline: 2px solid var(--ice);
      outline-offset: 3px;
      border-radius: 4px;
    }

    header {
      position: sticky;
      top: 0;
      height: 64px;
      padding: 0 var(--gutter);
      background: rgba(12, 10, 42, 0.74);
      -webkit-backdrop-filter: blur(14px) saturate(1.3);
      backdrop-filter: blur(14px) saturate(1.3);
      border-bottom: 1px solid var(--line);
    }

    .header-inner {
      height: 100%;
      max-width: 1320px;
      margin: 0 auto;
      display: flex;
      align-items: center;
    }

    .lockup {
      display: flex;
      align-items: center;
      gap: 11px;
      min-height: 44px;
      color: var(--text);
      font: 600 14px/20px var(--sans);
      letter-spacing: 0.22em;
      white-space: nowrap;
    }
    .lockup:hover { color: var(--text); text-decoration: none; }
    .lockup img { display: block; width: 22px; height: auto; }
    .lockup .divider { color: var(--text-3); }

    main {
      max-width: calc(68ch + 2 * var(--gutter));
      margin: 0 auto;
      padding: 48px var(--gutter) 96px;
    }

    .back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      margin-bottom: 32px;
      color: var(--text-2);
      font: 500 14px/20px var(--sans);
      text-decoration: none;
    }
    .back:hover { color: var(--text); text-decoration: none; }

    h1 {
      margin-bottom: 16px;
      font: 400 40px/44px var(--serif);
      letter-spacing: -0.01em;
      color: var(--text);
    }

    h2 {
      margin: 48px 0 12px;
      font: 600 24px/32px var(--sans);
      letter-spacing: -0.01em;
      color: var(--text);
    }

    h3 {
      margin: 32px 0 8px;
      font: 600 18px/28px var(--sans);
      color: var(--text);
    }

    p { margin: 0 0 16px; }
    strong { color: var(--text); font-weight: 600; }

    ul { margin: 0 0 16px; padding-left: 24px; }
    li { margin-bottom: 8px; }

    hr { margin: 48px 0; border: 0; border-top: 1px solid var(--line); }

    code {
      padding: 0 4px;
      background: var(--surface);
      border-radius: 4px;
      font: 400 14px/20px var(--mono);
      color: var(--text);
    }

    blockquote {
      margin: 0 0 24px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      font-size: 14px;
      line-height: 20px;
      color: var(--text-2);
    }

    .table-scroll { overflow-x: auto; margin: 0 0 24px; }

    table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 20px; }

    th, td {
      padding: 12px 16px 12px 0;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      font: 500 12px/16px var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
    }

    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
      display: flex;
      flex-wrap: wrap;
      gap: 12px 24px;
      font-size: 14px;
      line-height: 20px;
    }

    footer a { color: var(--text-3); text-decoration: none; }
    footer a:hover { color: var(--text); }

    @media (max-width: 1023px) { :root { --gutter: 32px; } }
    @media (max-width: 640px) {
      :root { --gutter: 16px; }
      main { padding-top: 32px; }
      h1 { font-size: 32px; line-height: 36px; }
    }
  </style>
</head>

<body>
  <header>
    <div class="header-inner">
      <a class="lockup" href="/" aria-label="SyberLabs RISE home">
        <img src="/syberlabs-mark.webp" alt="" width="18" height="20" decoding="async">
        <span aria-hidden="true">SYBERLABS<span class="divider"> / </span>RISE</span>
      </a>
    </div>
  </header>
  <main>
    <a class="back" href="/">${ARROW_LEFT}RISE</a>
${body.split('\n').map(line => `    ${line}`).join('\n')}
    <footer>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
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

for (const source of ['LICENSE', 'NOTICE', 'ASSET-LICENSES.md', 'PRIVACY.md']) {
    const bytes = readFileSync(join(ROOT, source));
    const target = join(ROOT, 'public', source);
    if (check) {
        if (!existsSync(target) || !readFileSync(target).equals(bytes)) {
            problems.push(`public/${source} does not match ${source}`);
        }
    } else {
        writeFileSync(target, bytes);
        process.stderr.write(`✓ ${source} → public/${source}\n`);
    }
}

if (check) {
    if (problems.length) {
        process.stderr.write(`\n✗ ${problems.join('\n✗ ')}\n\nRun: npm run build:legal\n`);
        process.exit(1);
    }
    process.stderr.write('✓ published legal pages and documents match their sources\n');
}
