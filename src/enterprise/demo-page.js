/**
 * The speaker-rail page. A transcript box stands in for the recognizer:
 * Draft is a partial, Final sentence is a finalized line. The clock advances
 * one dwell past each line so the page can be tried without waiting; the
 * session policy itself is unchanged.
 */

import { createDemoSession } from './demo.js';
import { renderRail } from './rail-view.js';

const { session } = createDemoSession((at) => at);
const rail = renderRail(document.querySelector('#rail'), session);
const transcript = document.querySelector('#transcript');
const speaker = document.querySelector('#speaker');
const debrief = document.querySelector('#debrief');
const hints = document.querySelector('#hints');

hints.textContent = session.hints().join(', ');

let at = 0;

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

function send(final) {
    const text = transcript.value.trim();
    if (!text) return;
    at += 9_000;
    const who = speaker.value;
    rail.hear({
        text,
        final,
        speaker: who,
        speakerId: who === 'presenter' ? 'ada' : 'guest',
        at
    });
    paintDebrief();
}

document.querySelector('[data-action="draft"]').addEventListener('click', () => send(false));
document.querySelector('[data-action="final"]').addEventListener('click', () => send(true));
paintDebrief();
