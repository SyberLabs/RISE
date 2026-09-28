/**
 * The live room page: microphone → recognition → evidence → candidates →
 * decision → rail → promote → gate → stage, with the trace beside it.
 *
 * Interim speech warms the lexical tier and shows the likely topic to the
 * presenter. A final sentence asks the chosen decider. JEV is the server
 * decision route; local rules is the explicit offline mode. A failed JEV
 * decision holds — it never falls back to rules on its own. The typed
 * transcript stays for browsers without a recognizer.
 */

import { createDemoSession } from './demo.js';
import { createLiveLoop, localDecider } from './live.js';
import { renderRail } from './rail-view.js';
import { createRecognizer, onDeviceStatus, speechRecognitionClass } from './recognition.js';
import { createRemoteDecider } from './remote-decider.js';
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
const transcript = $('#transcript');
const listenButton = $('#listen');
const status = $('#status');
const interim = $('#interim');
const speechNote = $('#speech-note');
const traceSummary = $('#trace-summary');
const debrief = $('#debrief');

const loop = createLiveLoop({
    session,
    trace,
    now: clock,
    decide: (context, options) => (deciderSelect.value === 'local' ? localDecider : remote)(context, options)
});
const stage = renderStage($('#stage'), session);
const rail = renderRail($('#rail'), session);

$('#hints').textContent = session.hints().join(', ');

const HOLD_TEXT = {
    stale: 'Newer speech arrived first, so that decision was dropped.',
    superseded: 'Newer speech arrived first, so that decision was dropped.',
    timeout: 'The decision took too long. Holding.',
    unavailable: 'The decision service is unavailable. Holding. Local rules work offline.',
    'rate-limited': 'Too many decisions in a minute. Holding.',
    error: 'The decision failed. Holding.',
    invalid: 'The decision was not one of the offered options. Holding.',
    untraced: 'A number on that card is not in its source. Holding.',
    dismissed: 'That card was dismissed. Holding.',
    cooldown: 'The rail is settling. Holding.',
    dwell: 'The rail is settling. Holding.',
    margin: 'The rail is full and nothing clearly better arrived.',
    duplicate: 'That card is already on the rail.',
    decider: 'Nothing offered fits. The rail stays as it is.',
    stopped: 'Stopped.'
};

function say(text) {
    status.textContent = text;
}

function paintDebrief() {
    const report = session.debrief();
    debrief.replaceChildren();
    if (!report.followUp.length) {
        debrief.textContent = 'No unanswered questions yet.';
        return;
    }
    for (const gap of report.followUp) {
        const item = document.createElement('li');
        item.textContent = `${gap.speaker}: ${gap.text}`;
        debrief.append(item);
    }
}

function paintTrace() {
    const summary = trace.summary();
    const { p50Ms, p95Ms, outcomes } = summary.decisions;
    const answered = outcomes.answered || 0;
    const failed = Object.entries(outcomes)
        .filter(([outcome]) => outcome !== 'answered')
        .reduce((total, [, count]) => total + count, 0);
    traceSummary.textContent = [
        `${summary.events} events`,
        `${answered} decisions answered`,
        `${failed} held for failure or cancellation`,
        p50Ms == null ? 'latency —' : `latency p50 ${p50Ms} ms, p95 ${p95Ms} ms`
    ].join(' · ');
}

function repaint() {
    rail.update();
    stage.update();
    paintDebrief();
    paintTrace();
}

function report(result) {
    if (!result || result.action === 'ignore') return;
    if (result.action === 'show') {
        const card = session.rail().find(item => item.id === result.cardId);
        say(`New suggestion on the rail: ${card?.title ?? result.cardId}. Promote it to show the room.`);
        return;
    }
    say(HOLD_TEXT[result.reason] || 'Holding.');
}

function speakerLabel() {
    return speakerSelect.value === 'presenter' ? program.presenterId : null;
}

async function handle(raw) {
    const event = mapRecognitionEvent(raw, { presenterIds: program.presenterIds });
    trace.emit(event.final ? 'speech.final' : 'speech.interim', {
        chars: event.text.length,
        speaker: event.speaker
    });
    if (!event.final) {
        const warmed = await loop.hear(event);
        const leader = warmed.leaders?.[0];
        interim.textContent = leader ? `${event.text} — likely: ${leader.title}` : event.text;
        paintTrace();
        return;
    }
    interim.textContent = '';
    say(`Deciding with ${deciderSelect.value === 'local' ? 'local rules' : 'JEV'}…`);
    const result = await loop.hear(event);
    report(result);
    repaint();
}

// Typed transcript: the same path the microphone takes.
function sendTyped(final) {
    const text = transcript.value.trim();
    if (!text) return;
    handle({ transcript: text, isFinal: final, speakerLabel: speakerLabel(), at: clock() });
}

$('[data-action="draft"]').addEventListener('click', () => sendTyped(false));
$('[data-action="final"]').addEventListener('click', () => sendTyped(true));
$('#rail').addEventListener('click', () => {
    stage.update();
    paintTrace();
});
$('#stage').addEventListener('click', () => {
    rail.update();
    paintTrace();
});
deciderSelect.addEventListener('change', () => {
    trace.emit('decider.change', { decider: deciderSelect.value });
    say(deciderSelect.value === 'local'
        ? 'Local rules decide. Nothing leaves this browser for a decision.'
        : 'JEV decides through the server decision route.');
    paintTrace();
});

$('#export-trace').addEventListener('click', () => {
    const payload = JSON.stringify({ ...trace.toJSON(), metrics: session.metrics() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `enterprise-trace-${session.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
});

// Microphone.
const Recognition = speechRecognitionClass(window);
const requireOnDevice = new URLSearchParams(location.search).get('speech') === 'on-device';
let recognizer = null;

function setListening(listening) {
    listenButton.textContent = listening ? 'Stop listening' : 'Listen';
    listenButton.setAttribute('aria-pressed', String(listening));
}

async function prepareRecognizer() {
    if (!Recognition) {
        listenButton.disabled = true;
        speechNote.textContent = 'This browser has no speech recognizer. Type the transcript below.';
        return;
    }
    const onDevice = (await onDeviceStatus(Recognition, LANG)) === 'available';
    if (requireOnDevice && !onDevice) {
        listenButton.disabled = true;
        speechNote.textContent = 'This room requires on-device speech recognition, and this browser cannot confirm it. '
            + 'Type the transcript below.';
        return;
    }
    speechNote.textContent = onDevice
        ? 'Speech is recognized on this device.'
        : 'Speech is recognized by this browser’s speech service, which may send audio to the browser vendor. '
            + 'Only the transcript window and card titles reach the decision route.';
    recognizer = createRecognizer({
        Recognition,
        lang: LANG,
        processLocally: onDevice,
        now: clock,
        onResult: ({ transcript: text, isFinal, at }) => {
            handle({ transcript: text, isFinal, speakerLabel: speakerLabel(), at });
        },
        onState: (state, detail) => {
            trace.emit('speech.state', { state, detail });
            if (state === 'listening') say('Listening.');
            if (state === 'stopped') say('Stopped listening.');
            if (state === 'error') say(`Listening stopped: ${detail}.`);
            setListening(state === 'listening' || state === 'starting');
            paintTrace();
        }
    });
}

listenButton.addEventListener('click', () => {
    if (!recognizer) return;
    if (recognizer.state === 'listening' || recognizer.state === 'starting') recognizer.stop();
    else recognizer.start();
});

setListening(false);
prepareRecognizer();
repaint();
