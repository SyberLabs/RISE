import { saveInvocationHandoff } from '../app/invocation.js';
import { rollReading } from '../core/roll.js';
import { SECTION_WORDS, summarizeJevPlan } from '../core/jev-describe.js';

// The crossing is a designed length, not a wait: the roll itself is instant.
const TRANSIT_MS = 900;

/**
 * Each jump composes a reading on this device, the way Home's ROLL does, and
 * never lands on the work or temper it just left. Nothing is sent.
 */
function localCourse() {
  let previous = null;
  return async () => {
    previous = rollReading({ previous });
    return previous.decision;
  };
}

/** What a destination says for itself: the same words Home uses. */
export function describeDestination(decision) {
  const title = decision.title || decision.workId.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title,
    meta: [decision.author, SECTION_WORDS[decision.config?.section]].filter(Boolean).join(' · '),
    plan: decision.config ? summarizeJevPlan(decision.config) : []
  };
}

/**
 * Coordinates for the readout: a fixed function of the decision, so the same
 * destination always reads the same. Decoration only.
 */
export function coordinatesOf(decision) {
  let hash = 2166136261;
  for (const char of `${decision.workId}:${decision.config?.section}:${decision.config?.wpm}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  const part = value => (value % 100000 / 1000).toFixed(3).padStart(6, '0');
  return `X: ${part(hash)}   Y: ${part(Math.imul(hash, 40503) >>> 0)}`;
}

/** Bind only presentation and invocation. No reading/session state lives here. */
export function mountWormhole(root, {
  request = localCourse(),
  save = saveInvocationHandoff,
  navigate = url => { window.location.assign(url); },
  describe = describeDestination,
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
} = {}) {
  const $ = selector => root.querySelector(selector);
  const launch = $('#jump'), destination = $('#destination'), prompt = $('#prompt');
  const status = $('#status');
  let busy = false, decision = null;

  // A control that is busy stays where it is, so focus is not thrown to the
  // top of the page: it says so (aria-disabled) and ignores presses.
  const setBusy = value => {
    busy = value;
    for (const control of root.querySelectorAll('#jump, #again, #dock, #adjust')) {
      if (value) control.setAttribute('aria-disabled', 'true');
      else control.removeAttribute('aria-disabled');
    }
    if (value) root.setAttribute('aria-busy', 'true');
    else root.removeAttribute('aria-busy');
  };

  async function jump() {
    if (busy) return;
    setBusy(true);
    decision = null;
    root.classList.add('is-jumping');
    root.classList.remove('has-destination');
    status.textContent = 'Crossing…';
    try {
      const found = await request();
      const words = await describe(found);
      if (!reduced) await new Promise(resolve => setTimeout(resolve, TRANSIT_MS));
      $('#title').textContent = words.title;
      $('#meta').textContent = words.meta;
      $('#plan').replaceChildren(...words.plan.map(part => {
        const item = document.createElement('li');
        item.textContent = part;
        return item;
      }));
      const readout = $('#coordinates');
      if (readout) readout.textContent = coordinatesOf(found);
      decision = found;
      prompt.hidden = true;
      destination.hidden = false;
      root.classList.add('has-destination');
      status.textContent = `Destination found: ${words.title}. ${[words.meta, ...words.plan].filter(Boolean).join(', ')}. Dock to read, or adjust the course.`;
      $('#dock').focus();
    } catch (error) {
      root.classList.remove('has-destination');
      destination.hidden = true;
      prompt.hidden = false;
      status.textContent = error?.message || 'The signal was lost. Try again.';
      launch.focus();
    } finally {
      setBusy(false);
      root.classList.remove('is-jumping');
    }
  }

  function handoff(action) {
    if (!decision || busy) return;
    try {
      save(decision, action);
      navigate('/?invocation=wormhole');
    } catch {
      status.textContent = 'This browser could not transfer the destination. Try opening RISE directly.';
    }
  }

  launch.addEventListener('click', jump);
  $('#again').addEventListener('click', jump);
  $('#dock').addEventListener('click', () => handoff('dock'));
  $('#adjust').addEventListener('click', () => handoff('adjust'));
  return { jump };
}
