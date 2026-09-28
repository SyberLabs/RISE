/**
 * The live room page.
 *
 * Two input channels. Speech from the microphone fills the transcript and,
 * on each final line, asks the chosen decider. Typing is the presenter's
 * private Ask, answered through the reasoning path. Neither cancels the
 * other. Both land on the same rail, and only Promote reaches the stage.
 *
 * The transcript lives in page memory only. The trace records speech as
 * character counts; this module never adds words to it, to storage, or to
 * an export. Status text and line notes name rail cards by title and never
 * show card content.
 */

import { createDemoSession } from './demo.js';
import { createDeviceDecider } from './device-decider.js';
import { DEFAULT_DEVICE_MODEL, DEVICE_MODELS, formatBytes } from './device-model.js';
import { createLiveLoop, localDecider } from './live.js';
import { renderRail } from './rail-view.js';
import { createRecognizer, onDeviceStatus, speechRecognitionClass } from './recognition.js';
import { createRemoteDecider } from './remote-decider.js';
import { WINDOW_FINALS } from './session.js';
import { mapRecognitionEvent } from './speech.js';
import { renderStage } from './stage-view.js';
import { createTrace } from './trace.js';

const LANG = 'en-US';
const clock = () => performance.now();
const trace = createTrace({ now: clock });
const { program, session } = createDemoSession(clock, { onEvent: trace.emit });
const remote = createRemoteDecider();

const $ = (selector) => document.querySelector(selector);
const deciderSelect = $('#decider');
const speakerSelect = $('#speaker');
const listenButton = $('#listen');
const speechBadge = $('#speech-badge');
const stateBox = $('#state');
const stateText = $('#state-text');
const lastDecision = $('#last-decision');
const transcript = $('#transcript');
const newLines = $('#new-lines');
const askForm = $('#ask-form');
const askInput = $('#ask');
const askAnswer = $('#ask-answer');

const requestedModel = new URLSearchParams(location.search).get('kev');
const deviceModel = DEVICE_MODELS[requestedModel] ? requestedModel : DEFAULT_DEVICE_MODEL;
let device = null;
const DECIDERS = {
    jev: (context, options) => remote(context, options),
    local: (context, options) => localDecider(context, options),
    device: (context, options) => device.decide(context, options)
};
const loop = createLiveLoop({
    session,
    trace,
    now: clock,
    decide: (context, options) => DECIDERS[deciderSelect.value](context, options)
});
const refresh = () => {
    rail.update();
    stage.update();
    paintDebrief();
    paintTrace();
};
const rail = renderRail($('#rail'), session, { onChange: refresh });
const stage = renderStage($('#stage'), session, { onChange: refresh });

const DECIDER_NAMES = { jev: 'JEV', local: 'Local rules', device: 'Kev (device)' };
const deciderName = () => DECIDER_NAMES[deciderSelect.value];

/* ---------- One status surface ---------- */

const HELD = {
    unavailable: () => `${deciderName()} is unavailable. Switch Decides to Local rules to keep going.`,
    timeout: () => `${deciderName()} took too long. Keep talking, or switch Decides to Local rules.`,
    'rate-limited': () => 'Too many decisions this minute. Pause briefly, or switch Decides to Local rules.',
    error: () => 'The decision failed. Keep talking; switch Decides to Local rules if it repeats.',
    invalid: () => `${deciderName()}’s answer wasn’t one of the offered cards, so nothing changed.`,
    cooldown: () => 'The rail is settling; the next card can land in a few seconds.',
    dwell: () => 'The rail is settling; the next card can land in a few seconds.',
    margin: () => 'The rail is full. Dismiss a card to make room.',
    full: () => 'The rail is full of cards on stage. Retract or dismiss one.',
    dismissed: () => 'You dismissed that card, so it stays off.',
    untraced: () => 'A number on that card isn’t in its source, so it stays off.',
    loading: () => 'Kev is still loading on this device; decisions hold until it’s ready.'
};

const NOTE = {
    superseded: 'skipped: newer speech',
    stale: 'skipped: newer speech',
    stopped: 'stopped',
    timeout: () => `held: ${deciderName()} timed out`,
    unavailable: () => `held: ${deciderName()} unavailable`,
    'rate-limited': 'held: rate limited',
    error: 'held: decision failed',
    invalid: 'held: answer refused',
    cooldown: 'held: rail settling',
    dwell: 'held: rail settling',
    margin: 'held: rail full',
    full: 'held: rail full',
    dismissed: 'held: you dismissed it',
    untraced: 'held: unsourced number',
    loading: 'held: Kev still loading'
};

function setState(name, text) {
    stateBox.dataset.state = name;
    stateText.textContent = text;
}

function idleText() {
    return recognizer ? 'Not listening. Press L or Listen.' : 'Speech isn’t available here. Use Ask.';
}

function titleOnRail(cardId) {
    return session.rail().find(card => card.id === cardId)?.title ?? null;
}

function stamp(started) {
    lastDecision.textContent = `${deciderName()} ${Math.round(clock() - started)} ms`;
}

/** What happened to a line or an ask, as a short note. Never card content. */
function outcome(result, { speaker = 'presenter', asked = false } = {}) {
    if (!result || result.action === 'ignore') return 'ignored';
    if (result.action === 'show') return `${titleOnRail(result.cardId) ?? 'card'} (on rail)`;
    if (result.reason === 'decider') {
        if (asked) return null;
        return speaker === 'audience' ? 'follow-up' : 'held: nothing fits';
    }
    if (result.reason === 'duplicate') {
        const title = titleOnRail(result.cardId);
        return title ? `${title} (already on rail)` : 'already on rail';
    }
    const note = NOTE[result.reason];
    return typeof note === 'function' ? note() : (note || 'held');
}

function reportState(result, label) {
    if (!result || result.action === 'ignore') return;
    if (result.reason === 'superseded' || result.reason === 'stale') return;
    if (result.action === 'show') {
        setState('ready', `On rail: ${titleOnRail(result.cardId) ?? 'a card'}. P promotes it.`);
    } else if (result.reason === 'decider') {
        setState(listening() ? 'listening' : 'idle', `${label}: nothing fits.`);
    } else if (result.reason === 'duplicate') {
        setState(listening() ? 'listening' : 'idle', 'Already on the rail.');
    } else {
        setState('held', `Held. ${(HELD[result.reason] || HELD.error)()}`);
    }
}

/* ---------- Transcript ---------- */

let interimLine = null;
const windowLines = [];

function atBottom() {
    return transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop < 8;
}

function toBottom() {
    transcript.scrollTop = transcript.scrollHeight;
    newLines.hidden = true;
}

function appendOrUpdate(update) {
    const stick = atBottom();
    update();
    $('#transcript-hint')?.remove();
    if (stick) toBottom();
    else newLines.hidden = false;
}

function makeLine(speaker) {
    const line = document.createElement('li');
    line.dataset.final = 'false';
    line.dataset.window = 'live';
    if (speaker === 'audience') {
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = 'Audience';
        line.append(who);
    }
    const text = document.createElement('span');
    text.className = 'text';
    const note = document.createElement('span');
    note.className = 'note';
    line.append(text, note);
    transcript.append(line);
    return line;
}

function markWindow(line) {
    windowLines.push(line);
    while (windowLines.length > WINDOW_FINALS) windowLines.shift().dataset.window = 'out';
    line.dataset.window = 'in';
}

function setNote(line, text) {
    line.querySelector('.note').textContent = text ? `→ ${text}` : '';
}

transcript.addEventListener('scroll', () => {
    if (atBottom()) newLines.hidden = true;
});
newLines.addEventListener('click', () => {
    toBottom();
    transcript.focus({ preventScroll: true });
});

/* ---------- Speech channel ---------- */

function speakerLabel() {
    return speakerSelect.value === 'presenter' ? program.presenterId : null;
}

function listening() {
    return recognizer?.state === 'listening' || recognizer?.state === 'starting';
}

async function onSpeech({ transcript: words, isFinal, at }) {
    const event = mapRecognitionEvent(
        { transcript: words, isFinal, speakerLabel: speakerLabel(), at },
        { presenterIds: program.presenterIds }
    );
    trace.emit(event.final ? 'speech.final' : 'speech.interim', { chars: event.text.length, speaker: event.speaker });

    if (!event.final) {
        appendOrUpdate(() => {
            if (!interimLine || interimLine.dataset.speaker !== event.speaker) {
                interimLine?.remove();
                interimLine = makeLine(event.speaker);
                interimLine.dataset.speaker = event.speaker;
            }
            interimLine.querySelector('.text').textContent = event.text;
        });
        const warmed = await loop.hear(event);
        const leader = warmed.leaders?.[0];
        setState('hearing', leader ? `Hearing… likely ${leader.title}` : 'Hearing…');
        return;
    }

    let line;
    appendOrUpdate(() => {
        line = interimLine && interimLine.dataset.speaker === event.speaker ? interimLine : makeLine(event.speaker);
        if (interimLine && interimLine !== line) interimLine.remove();
        interimLine = null;
        line.dataset.final = 'true';
        line.querySelector('.text').textContent = event.text;
        markWindow(line);
        setNote(line, `deciding with ${deciderName()}…`);
    });
    setState('deciding', `Deciding with ${deciderName()}…`);
    const started = clock();
    const result = await loop.hear(event);
    if (result.reason !== 'superseded' && result.reason !== 'stale') stamp(started);
    setNote(line, outcome(result, { speaker: event.speaker }));
    reportState(result, 'That line');
    refresh();
}

/* ---------- Ask channel ---------- */

askForm.addEventListener('submit', async (submitted) => {
    submitted.preventDefault();
    const text = askInput.value.trim();
    if (!text) return;
    askAnswer.textContent = `Deciding with ${deciderName()}…`;
    const started = clock();
    const result = await loop.reason({ text, at: clock() });
    if (result.reason === 'superseded' || result.reason === 'stale') return;
    stamp(started);
    const note = outcome(result, { asked: true });
    askAnswer.textContent = note ? `→ ${note}` : 'Nothing in this room’s sources fits.';
    reportState(result, 'That ask');
    refresh();
});

/* ---------- Keyboard ---------- */

document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]')) {
        if (event.key === 'Escape' && target === askInput) askInput.blur();
        return;
    }
    const key = event.key.toLowerCase();
    if (key === '/') {
        event.preventDefault();
        askInput.focus();
    } else if (key === 'l' && recognizer) {
        toggleListening();
    } else if (key === 'p') {
        const card = rail.promoteTarget();
        if (card) setState(listening() ? 'listening' : 'idle', `On stage: ${card.title}. R retracts it.`);
    } else if (key === 'd') {
        const card = rail.dismissTarget();
        if (card) setState(listening() ? 'listening' : 'idle', `Dismissed ${card.title}.`);
    } else if (key === 'r') {
        const card = session.stage().at(-1);
        if (card) {
            session.retract(card.id);
            refresh();
            setState(listening() ? 'listening' : 'idle', `Retracted ${card.title}.`);
        }
    }
});

/* ---------- Review surfaces ---------- */

function paintDebrief() {
    const report = session.debrief();
    const list = $('#debrief');
    list.replaceChildren();
    if (!report.followUp.length) {
        list.textContent = 'No unanswered questions yet.';
        return;
    }
    for (const gap of report.followUp) {
        const item = document.createElement('li');
        item.textContent = `${gap.speaker}: ${gap.text}`;
        list.append(item);
    }
}

function paintTrace() {
    const metrics = session.metrics();
    $('#metrics').textContent = [
        `Shown ${metrics.shown}`,
        `Promoted ${metrics.promoted}`,
        `Dismissed ${metrics.speakerDismissed}`,
        `Provenance ${metrics.provenanceComplete ? 'complete' : 'incomplete'}`
    ].join(' · ');
    const summary = trace.summary();
    const { p50Ms, p95Ms, outcomes } = summary.decisions;
    $('#trace-summary').textContent = [
        `${summary.events} events`,
        `${outcomes.answered || 0} decisions answered`,
        p50Ms == null ? 'latency —' : `latency p50 ${p50Ms} ms, p95 ${p95Ms} ms`
    ].join(' · ');
}

$('#export-trace').addEventListener('click', () => {
    const payload = JSON.stringify({ ...trace.toJSON(), metrics: session.metrics() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `enterprise-trace-${session.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
});

/* ---------- Kev on this device ---------- */

const DEVICE_FAILED = {
    'no-webgpu': 'This browser has no WebGPU, so Kev can’t run here. Choose JEV or Local rules.',
    'no-adapter': 'No usable GPU for WebGPU, so Kev can’t run here. Choose JEV or Local rules.',
    'wrong-model': 'The published Kev bundle isn’t the pinned checkpoint, so it wasn’t loaded.',
    'runtime-digest': 'The downloaded runtime didn’t match its pinned digest, so it wasn’t used.',
    network: 'Kev couldn’t be downloaded. Check the connection, then choose Kev (device) again.'
};

// Load progress uses the fixed decision-time slot so it never competes with
// the live status line.
function onDeviceChange(status) {
    if (deciderSelect.value !== 'device') return;
    if (status.state === 'loading') {
        const share = status.total ? Math.min(99, Math.floor((status.loaded / status.total) * 100)) : 0;
        lastDecision.textContent = status.loaded ? `Kev ${share}%` : 'Kev …';
    } else if (status.state === 'ready') {
        lastDecision.textContent = 'Kev ready';
        trace.emit('device.ready', { run: status.info.run, loadMs: status.info.loadMs, vendor: status.adapter?.vendor ?? null });
        setState(listening() ? 'listening' : 'idle', `Kev (${DEVICE_MODELS[deviceModel].label}) is ready on this device.`);
    } else if (status.state === 'failed') {
        lastDecision.textContent = 'Kev failed';
        trace.emit('device.failed', { code: status.code });
        setState('error', DEVICE_FAILED[status.code] || 'Kev couldn’t start on this device. Choose JEV or Local rules.');
    }
}

function useDevice() {
    if (device?.status().state === 'failed') device.dispose();
    device ??= createDeviceDecider({ model: deviceModel, onChange: onDeviceChange });
    if (device.status().state !== 'idle') {
        onDeviceChange(device.status());
        return;
    }
    const model = DEVICE_MODELS[deviceModel];
    setState('loading', `Loading ${model.label} on this device (${formatBytes(model.bytes)} the first time). Decisions hold until it’s ready.`);
    device.load();
}

deciderSelect.addEventListener('change', () => {
    trace.emit('decider.change', { decider: deciderSelect.value });
    if (deciderSelect.value === 'device') {
        useDevice();
        return;
    }
    const settled = ['held', 'error', 'loading'].includes(stateBox.dataset.state)
        ? (listening() ? 'listening' : 'idle')
        : stateBox.dataset.state;
    setState(settled, deciderSelect.value === 'local'
        ? 'Local rules decide. Nothing leaves this browser for a decision.'
        : 'JEV decides through the server.');
});

/* ---------- Microphone ---------- */

const Recognition = speechRecognitionClass(window);
const requireOnDevice = new URLSearchParams(location.search).get('speech') === 'on-device';
let recognizer = null;

const MIC_ERROR = {
    'not-allowed': 'Microphone blocked. Allow it in this site’s settings, then press Listen.',
    'service-not-allowed': 'Speech service blocked. Allow it in this site’s settings, then press Listen.',
    'audio-capture': 'No microphone found. Connect one, then press Listen.',
    'restart-limit': 'Speech keeps dropping. Check the connection, then press Listen.'
};

function toggleListening() {
    if (listening()) recognizer.stop();
    else recognizer.start();
}

function setListening(on) {
    listenButton.replaceChildren(on ? 'Stop' : 'Listen');
    if (on) listenButton.append(Object.assign(document.createElement('span'), { className: 'wide', textContent: ' listening' }));
    listenButton.setAttribute('aria-pressed', String(on));
}

function speechUnavailable(message) {
    listenButton.remove();
    speechBadge.remove();
    speakerSelect.remove();
    $('#transcript-hint')?.remove();
    const hint = document.createElement('p');
    hint.id = 'transcript-hint';
    hint.textContent = message;
    $('#transcript-panel').prepend(hint);
    transcript.hidden = true;
    $('#key-listen').remove();
    setState('idle', idleText());
}

async function prepareSpeech() {
    if (!Recognition) {
        // Browsers without a recognizer (Firefox, some Safari setups) get Ask only.
        speechUnavailable('Speech isn’t available in this browser. Use Ask.');
        return;
    }
    const onDevice = (await onDeviceStatus(Recognition, LANG)) === 'available';
    if (requireOnDevice && !onDevice) {
        speechUnavailable('This room requires on-device speech, which this browser can’t confirm. Use Ask.');
        return;
    }
    speechBadge.textContent = onDevice ? 'On-device speech' : 'Cloud speech';
    speechBadge.title = onDevice
        ? 'Speech is recognized on this device.'
        : 'This browser’s speech service may send audio to the browser vendor. Only the recent transcript and card titles reach the decision route.';
    recognizer = createRecognizer({
        Recognition,
        lang: LANG,
        processLocally: onDevice,
        now: clock,
        onResult: onSpeech,
        onState: (state, detail) => {
            if (state === 'warning') return;
            trace.emit('speech.state', { state, detail });
            setListening(state === 'listening' || state === 'starting');
            if (state === 'listening') setState('listening', 'Listening.');
            else if (state === 'stopped') setState('idle', idleText());
            else if (state === 'error') setState('error', MIC_ERROR[detail] || 'Speech couldn’t start. Use Ask, or press Listen to try again.');
        }
    });
    listenButton.addEventListener('click', toggleListening);
    const hint = document.createElement('p');
    hint.id = 'transcript-hint';
    hint.className = 'overlay';
    hint.textContent = 'Press Listen and start talking.';
    $('#transcript-panel').append(hint);
    setState('idle', idleText());
}

setListening(false);
setState('idle', 'Starting…');
refresh();
prepareSpeech();
