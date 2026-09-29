import { requestComposedReading, saveInvocationHandoff } from '../app/invocation.js';

const COURSES = [
  'Surprise me with a reading that feels like discovering a new world.',
  'Choose an unexpected quiet reading with a spacious atmosphere.',
  'Find a vivid reading with energy and a sense of motion.',
  'Surprise me with a strange, beautiful passage and a gentle pace.',
  'Choose a reading about wonder, distance, or returning home.'
];

/** Bind only presentation and invocation. No reading/session state lives here. */
export function mountWormhole(root, {
  request = requestComposedReading,
  save = saveInvocationHandoff,
  navigate = url => { window.location.assign(url); },
  titleOf = async (id, decision) => decision.title || id.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
} = {}) {
  const $ = selector => root.querySelector(selector);
  const launch = $('#jump'), destination = $('#destination'), prompt = $('#prompt');
  const status = $('#status');
  let busy = false, decision = null, course = -1;

  async function jump() {
    if (busy) return;
    busy = true;
    decision = null;
    destination.hidden = true;
    launch.disabled = true;
    root.classList.add('is-jumping');
    status.textContent = 'Searching for a destination…';
    course = (course + 1) % COURSES.length;
    try {
      const found = await request(COURSES[course]);
      const title = await titleOf(found.workId, found);
      // In reduced motion the destination is available immediately. Otherwise
      // leave a short interval for the transit, never for an artificial wait
      // after a slow network response.
      if (!reduced) await new Promise(resolve => setTimeout(resolve, 640));
      $('#title').textContent = title;
      $('#reason').textContent = found.reason || '';
      $('#coordinates').textContent = [found.config?.wpm && `${found.config.wpm} WPM`,
        found.config?.audio && found.config.audio !== 'silent' && found.config.audio.toUpperCase()]
        .filter(Boolean).join('  /  ');
      decision = found;
      prompt.hidden = true;
      destination.hidden = false;
      root.classList.add('has-destination');
      status.textContent = `Destination found: ${title}. Dock to read, or adjust the course.`;
      $('#dock').focus();
    } catch (error) {
      root.classList.remove('has-destination');
      prompt.hidden = false;
      status.textContent = error?.message || 'The signal was lost. Try again.';
      launch.focus();
    } finally {
      busy = false;
      launch.disabled = false;
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
