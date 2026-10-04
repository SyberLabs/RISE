import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { SEQUENCE_PILOT } from '../../content/sequence-pilot.js';
import { listSequencePilotFeedback } from '../../core/sequence-pilot-feedback.js';

function mount(provenance) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onExit = vi.fn();
  const chamber = new Chamber(container, {
    session: {
      title: 'Meditations', atoms: [{ content: 'A thought', duration: 500 }],
      totalDuration: 500, visualConfig: { visualMode: 'off' }, provenance
    },
    player: null, onExit
  });
  return { chamber, container, onExit };
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Keystone pilot completion', () => {
  it('offers one reasoned next reading and navigates only after the reader chooses it', () => {
    const { chamber, container, onExit } = mount({ kind: 'keystone', keystone: 'meditations' });
    const next = container.querySelector('#post-pilot-next');
    expect(next.textContent).toContain('Metamorphoses');
    expect(container.querySelector('#post-pilot-reason').textContent).toContain('Ovid');
    expect(onExit).not.toHaveBeenCalled();
    next.click();
    expect(onExit).toHaveBeenCalledWith('pilot-next', { slug: 'metamorphoses' });
    chamber.destroy();
  });

  it('stores no feedback without explicit local consent', () => {
    const { chamber, container } = mount({ kind: 'keystone', keystone: 'meditations' });
    const yes = container.querySelector('[data-pilot-feedback="yes"]');
    expect(yes.disabled).toBe(true);
    expect(container.querySelector('.post-pilot-data-note').textContent)
      .toContain('Clear All Personal Data');
    expect(listSequencePilotFeedback()).toEqual([]);
    container.querySelector('#post-pilot-consent').click();
    yes.click();
    expect(listSequencePilotFeedback()).toEqual([{
      sequenceId: SEQUENCE_PILOT[0].id, version: SEQUENCE_PILOT[0].version, value: 'yes'
    }]);
    chamber.destroy();
  });

  it('does not show pilot controls in an ordinary session', () => {
    const { chamber, container } = mount(undefined);
    expect(container.querySelector('#post-pilot-next')).toBeNull();
    expect(container.querySelector('#post-pilot-consent')).toBeNull();
    chamber.destroy();
  });
});
