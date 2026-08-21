#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inspectReleaseVoiceAssets } from './lib/release-voice-evidence.mjs';

const outDir = resolve('out/release/acoustic-review');
const report = await inspectReleaseVoiceAssets();
if (report.sourceIssues.length) {
  throw new Error(`Voice assets are not reviewable: ${JSON.stringify(report.sourceIssues)}`);
}

const review = {
  schema: 'rise.acoustic-review-package.v1',
  voiceId: report.voiceId,
  manifestHash: report.manifestHash,
  phraseCount: report.phraseCount,
  records: report.records
};
const embedded = JSON.stringify(review).replace(/</gu, '\\u003c');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RISE Keystone acoustic review</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    body { margin: 0; background: #09090b; color: #efedf8; }
    main { width: min(880px, calc(100% - 32px)); margin: 40px auto; }
    header, article, footer { border: 1px solid #302d3b; background: #111014; padding: 20px; }
    header { display: grid; gap: 12px; }
    .meta, .progress { color: #aaa4ba; font-size: 12px; }
    article { min-height: 330px; border-top: 0; }
    h1 { margin: 0; font: 500 20px Georgia, serif; }
    blockquote { margin: 30px 0; font: 26px/1.45 Georgia, serif; }
    audio { width: 100%; }
    .actions, footer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    button, input, textarea { border: 1px solid #484257; background: #17151c; color: inherit; padding: 11px; }
    button:hover { border-color: #9c86d7; }
    button.active { background: #31284a; border-color: #bca7f6; }
    textarea { width: 100%; min-height: 72px; box-sizing: border-box; margin-top: 10px; }
    footer { border-top: 0; grid-template-columns: 2fr 1fr 1fr; }
    @media (max-width: 620px) { .actions, footer { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>Keystone acoustic acceptance</h1>
    <div class="meta" id="identity"></div>
    <div class="progress" id="progress"></div>
  </header>
  <article>
    <div class="meta" id="position"></div>
    <blockquote id="text"></blockquote>
    <audio id="audio" controls preload="none"></audio>
    <textarea id="note" placeholder="Defect note (pronunciation, clipping, boundary, level…)"></textarea>
  </article>
  <div class="actions">
    <button id="previous">Previous</button>
    <button id="pass">Pass</button>
    <button id="defect">Defect</button>
    <button id="next">Next unreviewed</button>
  </div>
  <footer>
    <input id="reviewer" placeholder="Reviewer name">
    <button id="defects">Show defects</button>
    <button id="export">Export evidence</button>
  </footer>
</main>
<script>
  const review = ${embedded};
  const storageKey = 'rise-acoustic-review:' + review.manifestHash;
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  const state = { index: 0, decisions: saved.decisions || {}, reviewer: saved.reviewer || '' };
  const byId = id => document.getElementById(id);
  const persist = () => localStorage.setItem(storageKey, JSON.stringify({
    decisions: state.decisions,
    reviewer: state.reviewer
  }));
  const reviewed = () => Object.keys(state.decisions).length;
  const defects = () => Object.values(state.decisions).filter(item => item.status === 'defect');
  function render() {
    const item = review.records[state.index];
    const decision = state.decisions[item.key] || {};
    byId('identity').textContent = review.voiceId + ' · ' + review.manifestHash;
    byId('progress').textContent = reviewed() + '/' + review.phraseCount
      + ' reviewed · ' + defects().length + ' unresolved defects';
    byId('position').textContent = (state.index + 1) + '/' + review.phraseCount
      + ' · ' + item.keystone + ' · ' + item.key + ' · ' + item.durationMs + ' ms';
    byId('text').textContent = item.text;
    byId('audio').src = '../../../public' + item.asset;
    byId('note').value = decision.note || '';
    byId('pass').classList.toggle('active', decision.status === 'pass');
    byId('defect').classList.toggle('active', decision.status === 'defect');
  }
  function decide(status) {
    const item = review.records[state.index];
    state.decisions[item.key] = { status, note: byId('note').value.trim() };
    persist();
    nextUnreviewed();
  }
  function nextUnreviewed() {
    for (let offset = 1; offset <= review.records.length; offset += 1) {
      const index = (state.index + offset) % review.records.length;
      if (!state.decisions[review.records[index].key]) {
        state.index = index;
        render();
        return;
      }
    }
    state.index = Math.min(state.index + 1, review.records.length - 1);
    render();
  }
  byId('previous').onclick = () => { state.index = Math.max(0, state.index - 1); render(); };
  byId('next').onclick = nextUnreviewed;
  byId('pass').onclick = () => decide('pass');
  byId('defect').onclick = () => decide('defect');
  byId('note').onchange = () => {
    const item = review.records[state.index];
    if (state.decisions[item.key]) state.decisions[item.key].note = byId('note').value.trim();
    persist();
  };
  byId('reviewer').value = state.reviewer;
  byId('reviewer').onchange = event => { state.reviewer = event.target.value.trim(); persist(); };
  byId('defects').onclick = () => {
    const index = review.records.findIndex(item => state.decisions[item.key]?.status === 'defect');
    if (index >= 0) { state.index = index; render(); }
  };
  byId('export').onclick = () => {
    state.reviewer = byId('reviewer').value.trim();
    persist();
    const unresolved = defects();
    const complete = reviewed() === review.phraseCount && unresolved.length === 0 && state.reviewer;
    const evidence = {
      voiceId: review.voiceId,
      manifestHash: review.manifestHash,
      phraseCount: review.phraseCount,
      reviewedPhraseCount: reviewed(),
      unresolvedDefectCount: unresolved.length,
      reviewer: state.reviewer || null,
      completedAt: complete ? new Date().toISOString() : null,
      decisions: state.decisions
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2) + '\\n'], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'acoustic-review-evidence.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  render();
</script>
</body>
</html>`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'review-manifest.json'), `${JSON.stringify(review, null, 2)}\n`);
await writeFile(join(outDir, 'index.html'), html);
console.log(`Wrote ${report.phraseCount}-phrase acoustic review to ${outDir}`);
console.log(report.manifestHash);
