// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Try } from './Try.js';
import { TRY_SAMPLE, TRY_TEXT_MAX_CHARS } from '../../app/try-session.js';

let view;
afterEach(() => { view?.destroy(); view = null; document.body.innerHTML = ''; });

function engine({ audible = true } = {}) {
  return { init: vi.fn(async () => {}), resume: vi.fn(async () => {}), context: { state: audible ? 'running' : 'suspended' }, audible };
}

async function mount({ data = {}, begin = vi.fn(async () => true), audio = engine(), onNavigate } = {}) {
  document.body.innerHTML = '<main></main>';
  view = new Try(document.querySelector('main'), {
    data, onBeginSession: begin, onNavigate, ensureAudioEngine: async () => audio, getAudioEngine: () => audio
  });
  await view.audioReady;
  return { begin, audio, root: document.querySelector('main') };
}
const $ = selector => document.querySelector(selector);
const click = selector => $(selector).click();
const settle = () => vi.waitFor(() => expect(view.stage).not.toBe('preparing'));

describe('the /try/ entry screen (idle)', () => {
  it('shows only the title, author, duration, one sentence, Begin and the sound control', async () => {
    await mount();
    expect($('h1').textContent).toBe(TRY_SAMPLE.title);
    expect($('.try-meta').textContent).toContain(TRY_SAMPLE.author);
    expect($('[data-duration]').textContent).toBe('About 1 minute');
    expect($('.try-lede').textContent).toBe('RISE reads text with you — pacing, visuals and sound timed to the words.');
    expect($('[data-action="begin"]').textContent).toBe('Begin reading');
    expect($('[data-action="sound"]').getAttribute('role')).toBe('switch');
    expect($('[data-action="sound"]').getAttribute('aria-checked')).toBe('true');
    expect($('[data-status]').getAttribute('aria-live')).toBe('polite');
    expect($('[data-recover]').hidden).toBe(true);
    expect(view.stage).toBe('idle');
  });

  it('starts nothing until Begin is pressed', async () => {
    const { begin } = await mount();
    expect(begin).not.toHaveBeenCalled();
  });

  it('toggles sound off and on from the keyboard-reachable switch', async () => {
    await mount();
    click('[data-action="sound"]');
    expect($('[data-action="sound"]').getAttribute('aria-checked')).toBe('false');
    expect($('[data-sound-state]').textContent).toBe('off');
    click('[data-action="sound"]');
    expect($('[data-action="sound"]').getAttribute('aria-checked')).toBe('true');
  });
});

describe('Begin', () => {
  it('shows preparing at once, resumes audio inside the gesture, then plays the sample', async () => {
    let open;
    const begin = vi.fn(() => new Promise(resolve => { open = resolve; }));
    const { audio } = await mount({ begin });
    click('[data-action="begin"]');
    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(view.stage).toBe('preparing');
    expect($('[data-status]').textContent).toBe('Preparing the reading…');
    expect($('[data-action="begin"]').disabled).toBe(true);
    expect($('.try').getAttribute('aria-busy')).toBe('true');
    await vi.waitFor(() => expect(begin).toHaveBeenCalledTimes(1));
    expect(begin.mock.calls[0][0]).toMatchObject({ recitation: { enabled: true }, soundscape: 'aurora', origin: { view: 'try', kind: 'sample', run: 1 } });
    open(true);
    await settle();
    expect(view.stage).toBe('playing');
  });

  it('reads silently when sound is off, without asking for audio', async () => {
    const { begin, audio } = await mount();
    click('[data-action="sound"]');
    click('[data-action="begin"]');
    await settle();
    expect(audio.resume).not.toHaveBeenCalled();
    expect(begin.mock.calls[0][0]).toMatchObject({ recitation: { enabled: false }, soundscape: 'none' });
  });
});

describe('a failed preparation (error)', () => {
  it('says why, offers Retry and Read silently, and Read silently starts a silent reading', async () => {
    const begin = vi.fn(async config => { config.origin.failure = 'The voice could not be prepared.'; return false; });
    await mount({ begin });
    click('[data-action="begin"]');
    await settle();
    expect(view.stage).toBe('error');
    expect($('[data-status]').textContent).toBe('The voice could not be prepared.');
    expect($('[data-recover]').hidden).toBe(false);
    expect(document.activeElement).toBe($('[data-action="retry"]'));
    begin.mockImplementation(async () => true);
    click('[data-action="silent"]');
    await settle();
    expect(view.stage).toBe('playing');
    expect(begin.mock.calls.at(-1)[0]).toMatchObject({ recitation: { enabled: false }, origin: { run: 2 } });
    expect($('[data-action="sound"]').getAttribute('aria-checked')).toBe('false');
  });

  it('treats a browser that will not start sound as a recoverable error', async () => {
    const { begin } = await mount({ audio: engine({ audible: false }) });
    click('[data-action="begin"]');
    await settle();
    expect(begin).not.toHaveBeenCalled();
    expect($('[data-status]').textContent).toBe('Sound could not start in this browser.');
    expect($('[data-silent]').hidden).toBe(false);
  });

  it('Retry tries again with the same settings', async () => {
    const begin = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(true);
    await mount({ begin });
    click('[data-action="begin"]');
    await settle();
    expect(view.stage).toBe('error');
    click('[data-action="retry"]');
    await settle();
    expect(view.stage).toBe('playing');
    expect(begin.mock.calls[1][0].recitation.enabled).toBe(true);
  });

  it('offers no Read silently when the reading was already silent', async () => {
    await mount({ begin: vi.fn(async () => false) });
    click('[data-action="sound"]');
    click('[data-action="begin"]');
    await settle();
    expect($('[data-silent]').hidden).toBe(true);
  });
});

describe('the completion screen (complete)', () => {
  it('invites the visitor\'s own words, the publication pilot and a replay', async () => {
    await mount();
    view.update({ kind: 'sample', run: 1, stage: 'complete' });
    expect(view.stage).toBe('complete');
    expect($('h1').textContent).toBe('Now try your words.');
    expect(document.activeElement).toBe($('h1'));
    expect($('.try-lede').textContent).toBe('Bring a short excerpt and choose how it reads.');
    expect($('[data-action="own-text"]').getAttribute('href')).toBe('/try/your-text/');
    expect($('[data-action="own-text"]').textContent).toBe('Read your own text');
    expect($('[data-publication]').getAttribute('href')).toBe('https://syberlabs.io/services/');
    expect($('[data-publication]').textContent).toBe('Create a reading for your publication');
    expect($('[data-action="replay"]').textContent).toBe('Replay sample');
  });

  it('replays the sample through the preparing state', async () => {
    const { begin } = await mount();
    view.update({ kind: 'sample', run: 1, stage: 'complete' });
    click('[data-action="replay"]');
    expect($('[data-status]').textContent).toBe('Preparing the reading…');
    await settle();
    expect(view.stage).toBe('playing');
    expect(begin.mock.calls[0][0].origin.kind).toBe('sample');
  });

  it('opens the own-text step in place through the router', async () => {
    const onNavigate = vi.fn();
    await mount({ onNavigate });
    view.update({ kind: 'sample', run: 1, stage: 'complete' });
    click('[data-action="own-text"]');
    expect(onNavigate).toHaveBeenCalledWith('try', { kind: 'text' });
  });

  it('returns to the entry screen when the reader leaves a reading early', async () => {
    await mount();
    view.update({ kind: 'sample', run: 1, stage: 'idle' });
    expect($('h1').textContent).toBe(TRY_SAMPLE.title);
  });
});

describe('/try/your-text/', () => {
  const type = value => {
    const area = $('#try-text');
    area.value = value;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('has a labelled field, a stated limit with a live count, and an accurate note on where the text goes', async () => {
    await mount({ data: { kind: 'text' } });
    expect($('h1').textContent).toBe('Read your own text');
    expect($('label[for="try-text"]').textContent).toContain('up to 5,000 characters');
    expect($('#try-text').maxLength).toBe(TRY_TEXT_MAX_CHARS);
    expect($('[data-count]').textContent).toBe('0 / 5,000 characters');
    expect($('#try-text-privacy').textContent).toBe('Your text is prepared and read in this browser. It is not uploaded.');
    expect($('[data-action="begin"]').disabled).toBe(true);
    type('Some words of mine.');
    expect($('[data-count]').textContent).toBe('19 / 5,000 characters');
    expect($('[data-action="begin"]').disabled).toBe(false);
  });

  it('reads the text, then offers Read again, Edit text and the publication pilot', async () => {
    const { begin } = await mount({ data: { kind: 'text' } });
    type('Some words of mine.');
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(begin.mock.calls[0][0]).toMatchObject({ text: 'Some words of mine.', recitation: { enabled: false }, origin: { kind: 'text' } });
    view.update({ kind: 'text', run: 1, stage: 'complete' });
    expect($('[data-action="again"]').textContent).toBe('Read again');
    expect($('[data-publication]').getAttribute('href')).toBe('https://syberlabs.io/services/');
    click('[data-action="again"]');
    await settle();
    expect(begin).toHaveBeenCalledTimes(2);
    view.update({ kind: 'text', run: 2, stage: 'complete' });
    click('[data-action="edit"]');
    expect($('#try-text').value).toBe('Some words of mine.');
  });

  it('does not begin with nothing to read', async () => {
    const { begin } = await mount({ data: { kind: 'text' } });
    type('   ');
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(begin).not.toHaveBeenCalled();
    expect(view.stage).toBe('idle');
  });
});
