import { sequences } from './sequences.js';

const approved = sequences.filter((sequence) => sequence.approvedForDemo === true);
const byId = (id) => document.getElementById(id);
const LEGACY_STORAGE_KEY = 'rise-sequence-preview-v1';
let current = null;
let next = null;

function show(screen, heading) {
  for (const id of ['choice-screen', 'read-screen', 'finish-screen']) byId(id).hidden = id !== screen;
  document.title = `${heading} · RISE short sequences`;
  byId('main').focus();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function openSequence(sequence) {
  current = sequence;
  byId('read-title').textContent = sequence.title;
  byId('read-promise').textContent = sequence.promise;
  byId('source-credit').textContent = `${sequence.source.credit}. ${sequence.source.rights}`;
  byId('next-step-input').value = '';
  const container = byId('steps');
  container.replaceChildren();
  for (const step of sequence.steps) {
    const section = document.createElement('section');
    section.className = 'step';
    const heading = document.createElement('h2');
    heading.textContent = step.heading;
    const body = document.createElement('p');
    body.textContent = step.body;
    section.append(heading, body);
    container.append(section);
  }
  show('read-screen', sequence.title);
}

function renderCards() {
  const container = byId('sequence-cards');
  for (const sequence of approved) {
    const button = document.createElement('button');
    button.className = 'sequence-card';
    button.type = 'button';
    const title = document.createElement('h2');
    title.textContent = sequence.title;
    const promise = document.createElement('p');
    promise.textContent = sequence.promise;
    const action = document.createElement('span');
    action.className = 'card-action';
    action.textContent = 'Read and choose a step →';
    button.append(title, promise, action);
    button.addEventListener('click', () => openSequence(sequence));
    container.append(button);
  }
}

function finishReading(event) {
  event.preventDefault();
  const step = byId('next-step-input').value.trim();
  if (!step) {
    byId('next-step-input').value = '';
    byId('next-step-input').reportValidity();
    return;
  }
  byId('takeaway-text').textContent = step;
  byId('copy-status').textContent = 'This step is only in this tab. Copy it before you leave.';
  const index = approved.indexOf(current);
  next = approved[index + 1] ?? null;
  byId('next-card').hidden = !next;
  if (next) {
    byId('next-title').textContent = next.title;
    byId('next-promise').textContent = next.promise;
  }
  show('finish-screen', 'Your next step');
}

async function copyStep() {
  try {
    await navigator.clipboard.writeText(byId('takeaway-text').textContent);
    byId('copy-status').textContent = 'Copied. Your words are ready to paste wherever you keep your plans.';
  } catch {
    byId('copy-status').textContent = 'Copy was blocked by this browser. Select the text above to copy it manually.';
  }
}

renderCards();
try {
  byId('legacy-record').hidden = localStorage.getItem(LEGACY_STORAGE_KEY) === null;
} catch {
  // The reading works without browser storage.
}
byId('erase-legacy').addEventListener('click', () => {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    byId('legacy-record').hidden = true;
  } catch {
    byId('legacy-status').textContent = 'This browser could not erase the record. Clear this site’s storage in browser settings.';
  }
});
byId('back-choice').addEventListener('click', () => show('choice-screen', 'Choose a sequence'));
byId('next-step-form').addEventListener('submit', finishReading);
byId('copy-step').addEventListener('click', copyStep);
byId('back-reading').addEventListener('click', () => show('read-screen', current.title));
byId('all-sequences').addEventListener('click', () => show('choice-screen', 'Choose a sequence'));
byId('start-next').addEventListener('click', () => { if (next) openSequence(next); });
