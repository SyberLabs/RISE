import { sequences } from './sequences.js';
import { selectSequence } from './selector.js';

const STORAGE_KEY = 'rise-sequence-preview-v1';
const byId = (id) => document.getElementById(id);
const approved = sequences.filter((sequence) => sequence.approvedForDemo === true);
let records = [];
let current = null;
let stepIndex = 0;
let nextSuggestion = null;
let saveOnDevice = false;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function removeStored() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function showRestoreStatus() {
  const last = records.at(-1);
  byId('resume-panel').hidden = !saveOnDevice || records.length === 0;
  if (!last || !saveOnDevice) return;
  byId('resume-status').textContent = `${records.length} saved reading record${records.length === 1 ? '' : 's'} restored. Choose a sequence to continue this preview.`;
  const invited = approved.find((sequence) => sequence.id === last.nextInvitationId);
  byId('resume-next').hidden = !last.completed || last.nextStarted || !invited;
  if (invited) byId('resume-next').textContent = `Read the saved invitation: ${invited.title} →`;
}

function show(screen, heading) {
  for (const id of ['choice-screen', 'read-screen', 'finish-screen']) byId(id).hidden = id !== screen;
  document.title = `${heading} · RISE short sequences`;
  byId('main').focus();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function chosenRoute() {
  return document.querySelector('input[name="route"]:checked').value;
}

function chosenPreference() {
  return byId('interest').value;
}

function persist() {
  if (!saveOnDevice) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records }));
    byId('storage-status').textContent = 'Saved on this device only.';
  } catch {
    saveOnDevice = false;
    byId('save-local').checked = false;
    byId('storage-status').textContent = 'This browser could not save locally. You can still download the record.';
  }
}

function addRecord(sequence, selectedBy, decision = null) {
  current = sequence;
  stepIndex = 0;
  records.push({
    sequenceId: sequence.id,
    sequenceVersion: sequence.version,
    startedOn: today(),
    requestedRoute: chosenRoute(),
    preference: chosenPreference(),
    selectedBy,
    selectionDecision: decision,
    completed: false,
    worthTime: null,
    nextInvitationId: null,
    nextDecision: null,
    nextStarted: false,
    nextStartedOn: null,
  });
  persist();
  showRestoreStatus();
  byId('read-title').textContent = sequence.title;
  byId('read-promise').textContent = sequence.promise;
  byId('source-credit').textContent = `${sequence.source.title}. ${sequence.source.credit}. ${sequence.source.rights}`;
  document.querySelector('input[name="pace"][value="steady"]').checked = true;
  document.querySelector('input[name="presentation"][value="spacious"]').checked = true;
  renderSteps();
  show('read-screen', sequence.title);
}

const ARROW = '<svg class="icon row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

function renderCards() {
  const container = byId('sequence-cards');
  container.replaceChildren();
  approved.forEach((sequence, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'sequence-row';
    button.type = 'button';
    const number = document.createElement('span');
    number.className = 'label';
    number.textContent = String(index + 1).padStart(2, '0');
    const text = document.createElement('span');
    text.className = 'row-text';
    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = sequence.title;
    const promise = document.createElement('span');
    promise.className = 'row-promise';
    promise.textContent = sequence.promise;
    text.append(title, promise);
    const time = document.createElement('span');
    time.className = 'row-time';
    time.textContent = `About ${sequence.estimatedMinutes} min`;
    button.append(number, text, time);
    button.insertAdjacentHTML('beforeend', ARROW);
    button.addEventListener('click', () => addRecord(sequence, 'reader-choice'));
    item.append(button);
    container.append(item);
  });
}

function renderSteps() {
  const full = document.querySelector('input[name="pace"]:checked').value === 'brief';
  const compact = document.querySelector('input[name="presentation"]:checked').value === 'plain';
  byId('steps').classList.toggle('compact', compact);
  const visible = full ? current.steps : [current.steps[stepIndex]];
  const container = byId('steps');
  container.replaceChildren();
  visible.forEach((step) => {
    const actualIndex = current.steps.indexOf(step);
    const section = document.createElement('section');
    section.className = 'step';
    const number = document.createElement('div');
    number.className = 'step-number';
    number.textContent = `Part ${actualIndex + 1} of ${current.steps.length}`;
    const heading = document.createElement('h2');
    heading.textContent = step.heading;
    const body = document.createElement('p');
    body.textContent = step.body;
    section.append(number, heading, body);
    container.append(section);
  });
  byId('step-count').textContent = full ? 'Full sequence' : `Part ${stepIndex + 1} of ${current.steps.length}`;
  byId('previous-step').hidden = full || stepIndex === 0;
  byId('next-step').hidden = full || stepIndex === current.steps.length - 1;
  byId('finish').hidden = !full && stepIndex < current.steps.length - 1;
}

function completedIds() {
  return records.filter((record) => record.completed).map((record) => record.sequenceId);
}

function renderSummary() {
  const last = records.at(-1);
  const completed = records.filter((record) => record.completed).length;
  byId('record-summary').textContent = `${completed} completed · next chosen by: ${last.requestedRoute === 'bounded-jev' ? 'match my interest (a rule on this device)' : 'curated order'} · AI service calls: 0 · cost: $0`;
}

function finishSequence() {
  const last = records.at(-1);
  last.completed = true;
  const result = selectSequence({ sequences: approved, completedIds: completedIds(), preference: last.preference, mode: last.requestedRoute });
  nextSuggestion = result.selected;
  last.nextInvitationId = result.selected?.id ?? null;
  last.nextDecision = result.decision;
  byId('next-card').hidden = !result.selected;
  byId('no-next').hidden = Boolean(result.selected);
  if (result.selected) {
    byId('next-title').textContent = result.selected.title;
    byId('next-promise').textContent = result.selected.promise;
    byId('next-reason').textContent = result.decision.mode === 'bounded-jev-simulation'
      ? 'A simple rule on this device matched your interest to another sequence in this set. Jev was not called.'
      : 'This is next in the curated order. Jev was not called.';
  }
  for (const button of document.querySelectorAll('[data-worth]')) button.setAttribute('aria-pressed', 'false');
  byId('feedback-status').textContent = 'You can leave this unanswered.';
  renderSummary();
  persist();
  show('finish-screen', 'Sequence complete');
}

function exportRecord() {
  const payload = { schemaVersion: 1, sequencePreview: true, providerCalls: 0, providerCostUsd: 0, records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rise-sequence-preview-feedback.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  byId('storage-status').textContent = 'Your record was downloaded because you asked for it.';
}

function start() {
  const interests = [
    ['calm', 'Calm'],
    ['energize', 'Focus and energy'],
    ['reflect', 'Reflection'],
  ];
  for (const [value, label] of interests) {
    if (!approved.some((sequence) => sequence.tags?.includes(value))) continue;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    byId('interest').append(option);
  }
  renderCards();
  byId('suggest-first').addEventListener('click', () => {
    const result = selectSequence({ sequences: approved, mode: 'curated' });
    if (result.selected) addRecord(result.selected, 'suggestion-accepted', result.decision);
  });
  byId('back-choice').addEventListener('click', () => show('choice-screen', 'Choose a sequence'));
  byId('previous-step').addEventListener('click', () => { stepIndex -= 1; renderSteps(); });
  byId('next-step').addEventListener('click', () => { stepIndex += 1; renderSteps(); });
  byId('finish').addEventListener('click', finishSequence);
  for (const input of document.querySelectorAll('input[name="pace"], input[name="presentation"]')) input.addEventListener('change', renderSteps);
  for (const button of document.querySelectorAll('[data-worth]')) button.addEventListener('click', () => {
    records.at(-1).worthTime = button.dataset.worth;
    for (const item of document.querySelectorAll('[data-worth]')) item.setAttribute('aria-pressed', String(item === button));
    byId('feedback-status').textContent = 'Answer recorded in this session. You can change it here.';
    persist();
  });
  byId('start-next').addEventListener('click', () => {
    if (!nextSuggestion) return;
    records.at(-1).nextStarted = true;
    records.at(-1).nextStartedOn = today();
    persist();
    addRecord(nextSuggestion, 'suggestion-accepted', records.at(-1).nextDecision);
  });
  byId('resume-next').addEventListener('click', () => {
    const last = records.at(-1);
    const invited = approved.find((sequence) => sequence.id === last?.nextInvitationId);
    if (!last?.completed || last.nextStarted || !invited) return;
    last.nextStarted = true;
    last.nextStartedOn = today();
    const decision = last.nextDecision;
    for (const route of document.querySelectorAll('input[name="route"]')) route.checked = route.value === last.requestedRoute;
    byId('interest').value = last.preference;
    persist();
    addRecord(invited, 'suggestion-accepted', decision);
  });
  byId('save-local').addEventListener('change', (event) => {
    saveOnDevice = event.target.checked;
    if (saveOnDevice) {
      persist();
      showRestoreStatus();
    }
    else {
      const removed = removeStored();
      byId('resume-panel').hidden = true;
      byId('storage-status').textContent = removed
        ? 'Saved data erased from this device. This open page still holds the session until you close it or erase it.'
        : 'The browser could not erase its saved copy. Clear this site’s storage in your browser settings.';
    }
  });
  byId('export-record').addEventListener('click', exportRecord);
  byId('clear-record').addEventListener('click', () => {
    const removed = removeStored();
    saveOnDevice = false;
    byId('save-local').checked = false;
    records = [];
    current = null;
    nextSuggestion = null;
    byId('resume-panel').hidden = removed;
    byId('resume-status').textContent = removed ? '' : 'This page’s record is cleared, but the browser could not erase its saved copy. Clear this site’s storage in browser settings.';
    byId('storage-status').textContent = removed ? 'Data erased.' : 'This page’s record is cleared, but the saved copy could not be erased.';
    show('choice-screen', 'Choose a sequence');
  });

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.schemaVersion === 1 && Array.isArray(saved.records)) {
      records = saved.records.filter((record) => record && typeof record.sequenceId === 'string' && typeof record.completed === 'boolean');
      saveOnDevice = true;
      byId('save-local').checked = true;
      showRestoreStatus();
    }
  } catch {
    // The demo remains usable without browser storage.
  }
}

start();
