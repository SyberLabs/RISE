/**
 * A measurement page for Kev on this device: load time, GPU, per-decision
 * latency, and agreement with the server decider and the local rules, over
 * a fixed set of rail questions built from the demo room. The questions are
 * fixtures, not anyone's speech.
 */

import { createDemoSession } from './demo.js';
import { createDeviceDecider } from './device-decider.js';
import { DEFAULT_DEVICE_MODEL, DEVICE_MODELS, formatBytes } from './device-model.js';
import { localDecider } from './live.js';
import { createRemoteDecider } from './remote-decider.js';

const LINES = [
    ['presenter', 'Good morning everyone, thanks for coming'],
    ['presenter', 'Let us start with the Atlas renewal'],
    ['presenter', 'What was the Atlas renewal price'],
    ['presenter', 'Northwind renewed the Atlas plan this quarter'],
    ['presenter', 'Now the pipeline revenue by quarter'],
    ['presenter', 'Revenue grew every quarter this year'],
    ['presenter', 'Q3 was our strongest quarter for pipeline'],
    ['presenter', 'How did sales change over the year'],
    ['presenter', 'I will skip the acquisition for now'],
    ['presenter', 'The acquisition price stays confidential'],
    ['presenter', 'Hello, hello, can everyone hear me'],
    ['presenter', 'Let me share my screen'],
    ['presenter', 'Before lunch a quick word on hiring'],
    ['presenter', 'Our customers keep asking about renewals'],
    ['presenter', 'The Atlas plan is our largest contract'],
    ['presenter', 'Let us look at the revenue table'],
    ['presenter', 'That covers the numbers'],
    ['presenter', 'Any questions so far'],
    ['audience', 'What did Northwind pay for Atlas'],
    ['audience', 'How much revenue did we book in Q2'],
    ['audience', 'Is the cafeteria open on Friday'],
    ['audience', 'What is the acquisition price'],
    ['audience', 'When does the Atlas contract renew'],
    ['audience', 'Can you repeat the pipeline figure'],
    ['audience', 'Where can I find the slides'],
    ['ask', 'Atlas renewal price'],
    ['ask', 'pipeline revenue by quarter'],
    ['ask', 'Northwind contract'],
    ['ask', 'acquisition price'],
    ['ask', 'cafeteria menu']
];

const $ = (selector) => document.querySelector(selector);
const out = $('#out');
const status = $('#status');
const modelSelect = $('#model');

for (const [id, model] of Object.entries(DEVICE_MODELS)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${model.label} (${formatBytes(model.bytes)})`;
    option.selected = id === DEFAULT_DEVICE_MODEL;
    modelSelect.append(option);
}

function contextFor([speaker, text], index) {
    const { program, session } = createDemoSession((at) => at);
    const turn = speaker === 'ask'
        ? session.prepareReasoning({ text, at: index })
        : session.prepare({ text, final: true, speaker, speakerId: speaker === 'presenter' ? program.presenterId : null, at: index });
    return turn.context;
}

async function timed(decide, context, timeoutMs) {
    const started = performance.now();
    try {
        const { raw, meta } = await decide(context, { signal: AbortSignal.timeout(timeoutMs) });
        return { action: raw.action, cardId: raw.cardId, layout: raw.layout, ms: Math.round(performance.now() - started), confidence: meta?.confidence ?? null };
    } catch (error) {
        return { error: error?.reason || error?.name || 'error', ms: Math.round(performance.now() - started) };
    }
}

const same = (a, b) => !a.error && !b.error && a.action === b.action && (a.action !== 'show' || a.cardId === b.cardId);

function percentile(values, fraction) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

async function run() {
    $('#run').disabled = true;
    const modelId = modelSelect.value;
    const report = { page: 'kev-check', model: modelId, userAgent: navigator.userAgent, startedAt: new Date().toISOString() };
    const device = createDeviceDecider({
        model: modelId,
        onChange: (s) => {
            if (s.state === 'loading') status.textContent = `Loading: ${s.phase ?? ''} ${formatBytes(s.loaded)} of ${formatBytes(s.total)}`;
        }
    });
    const loadStarted = performance.now();
    const loaded = await device.load();
    report.load = { state: loaded.state, code: loaded.code, detail: loaded.detail, ms: Math.round(performance.now() - loadStarted), adapter: loaded.adapter, info: loaded.info };
    if (loaded.state !== 'ready') {
        status.textContent = `Kev did not load: ${loaded.code}${loaded.detail ? ` (${loaded.detail})` : ''}.`;
        out.value = JSON.stringify(report, null, 2);
        $('#run').disabled = false;
        return;
    }

    const server = createRemoteDecider();
    const rows = [];
    for (const [index, line] of LINES.entries()) {
        status.textContent = `Deciding ${index + 1} of ${LINES.length}…`;
        const context = contextFor(line, index);
        rows.push({
            channel: line[0],
            text: line[1],
            candidates: context.structure.candidates.map(c => c.id),
            device: await timed(device.decide, context, 10_000),
            server: await timed(server, context, 10_000),
            rules: await timed(localDecider, context, 1_000)
        });
    }
    const deviceMs = rows.filter(r => !r.device.error).map(r => r.device.ms);
    const withServer = rows.filter(r => !r.server.error);
    report.summary = {
        questions: rows.length,
        deviceErrors: rows.filter(r => r.device.error).length,
        deviceP50Ms: percentile(deviceMs, 0.5),
        deviceP95Ms: percentile(deviceMs, 0.95),
        serverAnswered: withServer.length,
        agreeWithServer: withServer.length ? withServer.filter(r => same(r.device, r.server)).length : null,
        agreeWithRules: rows.filter(r => same(r.device, r.rules)).length
    };
    report.rows = rows;
    device.dispose();
    const s = report.summary;
    status.textContent = `Done. Device p50 ${s.deviceP50Ms} ms, p95 ${s.deviceP95Ms} ms; `
        + `agrees with server on ${s.agreeWithServer ?? '—'} of ${s.serverAnswered}, with rules on ${s.agreeWithRules} of ${s.questions}.`;
    out.value = JSON.stringify(report, null, 2);
    $('#run').disabled = false;
}

$('#run').addEventListener('click', run);
$('#download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([out.value], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'kev-check.json' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
});
