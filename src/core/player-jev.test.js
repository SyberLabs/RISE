import { describe, expect, it, vi } from 'vitest';
import { Player } from './player.js';
import { Atom, Session } from './models.js';

function text(content, { sourceId = 'work', tags = [] } = {}) {
  return new Atom({ content, sourceId, tags, duration: 100 });
}

function decision(action = 'continue') {
  return { action, model: 'openai/gpt-4.1-mini' };
}

describe('Player Jev passage gate', () => {
  it('does not emit first text until the required decision continues', async () => {
    let resolve;
    const jevConductor = { decide: vi.fn(() => new Promise(r => { resolve = r; })) };
    const player = new Player(new Session({ atoms: [text('first')] }), { jevConductor });
    const atoms = vi.fn();
    player.on('atom', atoms);

    player.play();
    expect(atoms).not.toHaveBeenCalled();
    expect(player.state).toBe('idle');
    expect(jevConductor.decide).toHaveBeenCalledWith(expect.objectContaining({ excerpt: 'first' }));

    resolve(decision());
    await vi.waitFor(() => expect(atoms).toHaveBeenCalledTimes(1));
    expect(player.state).toBe('playing');
    player.destroy();
  });

  it('blocks failed decisions and retries through ordinary play', async () => {
    const jevConductor = { decide: vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(decision()) };
    const player = new Player(new Session({ atoms: [text('first')] }), { jevConductor });
    const atoms = vi.fn();
    player.on('atom', atoms);

    player.play();
    await vi.waitFor(() => expect(player.state).toBe('paused'));
    expect(atoms).not.toHaveBeenCalled();
    player.play();
    await vi.waitFor(() => expect(atoms).toHaveBeenCalledTimes(1));
    expect(jevConductor.decide).toHaveBeenCalledTimes(2);
    player.destroy();
  });

  it('gates the next authored paragraph before revealing its first atom', async () => {
    let approveSecond;
    const jevConductor = { decide: vi.fn()
      .mockResolvedValueOnce(decision())
      .mockImplementationOnce(() => new Promise(resolve => { approveSecond = resolve; })) };
    const session = new Session({ atoms: [
      text('first'),
      new Atom({ content: '', modality: 'text', tags: ['paragraph-break'], duration: 16 }),
      text('second')
    ] });
    const player = new Player(session, { jevConductor });
    const emitted = vi.fn();
    player.on('atom', emitted);
    player.play();
    await vi.waitFor(() => expect(player.state).toBe('playing'));
    player.sessionState.currentIndex = 1;
    player.advanceToNext();
    await vi.waitFor(() => expect(jevConductor.decide).toHaveBeenCalledTimes(2));
    expect(jevConductor.decide.mock.calls[1][0].excerpt).toBe('second');
    await Promise.resolve();
    expect(player.sessionState.currentIndex).toBe(2);
    expect(emitted).toHaveBeenCalledTimes(1);
    approveSecond(decision());
    await vi.waitFor(() => expect(emitted).toHaveBeenCalledTimes(2));
    expect(emitted.mock.calls[1][0].atom.content).toBe('second');
    player.destroy();
  });

  it('finds paragraph-mode boundaries in the compiled source coordinates', async () => {
    const jevConductor = { decide: vi.fn().mockResolvedValue(decision()) };
    const atoms = [
      new Atom({ content: 'first', sourceId: 'work', sourceCharacterStart: 0, sourceCharacterEnd: 5 }),
      new Atom({ content: 'second', sourceId: 'work', sourceCharacterStart: 7, sourceCharacterEnd: 13 })
    ];
    const session = new Session({ atoms, sources: [{ id: 'work', raw: 'first\n\nsecond' }] });
    const player = new Player(session, { jevConductor });
    player.play();
    await vi.waitFor(() => expect(player.state).toBe('playing'));
    player.sessionState.currentIndex = 0;
    player.advanceToNext();
    await vi.waitFor(() => expect(jevConductor.decide).toHaveBeenCalledTimes(2));
    expect(jevConductor.decide.mock.calls[1][0].excerpt).toBe('second');
    player.destroy();
  });

  it('slows by increasing duration, caps repeated requests, and preserves devotional pacing', async () => {
    const ordinary = new Player(new Session({ atoms: [text('first')] }), {
      jevConductor: { decide: vi.fn().mockResolvedValue(decision('slower')) }
    });
    const jevEvents = vi.fn();
    ordinary.on('jev', jevEvents);
    ordinary.play();
    await vi.waitFor(() => expect(ordinary.state).toBe('playing'));
    expect(jevEvents).toHaveBeenCalledWith(expect.objectContaining({ state: 'ready', action: 'slower' }));
    expect(ordinary.speedFactor).toBe(1.25);
    expect(ordinary._atomDisplayMs(ordinary.sessionState.currentAtom)).toBeGreaterThan(100);
    ordinary.speedFactor = 1.9;
    ordinary._applyJevSlower();
    expect(ordinary.speedFactor).toBe(2);
    ordinary._applyJevSlower();
    expect(ordinary.speedFactor).toBe(2);
    ordinary.destroy();

    const devotional = new Player(new Session({ atoms: [text('first')], shuttleExempt: true }), {
      jevConductor: { decide: vi.fn().mockResolvedValue(decision('slower')) }
    });
    devotional.play();
    await vi.waitFor(() => expect(devotional.state).toBe('playing'));
    expect(devotional.speedFactor).toBe(1);
    devotional.destroy();
  });

  it('ignores an approval that arrives after the user pauses', async () => {
    let resolve;
    const jevConductor = { decide: () => new Promise(r => { resolve = r; }) };
    const player = new Player(new Session({ atoms: [text('first')] }), { jevConductor });
    const atoms = vi.fn();
    player.on('atom', atoms);
    player.play();
    expect(resolve).toBeTypeOf('function');
    player.pause();
    resolve(decision());
    await Promise.resolve();
    await Promise.resolve();
    expect(atoms).not.toHaveBeenCalled();
    expect(player.state).toBe('paused');
    player.destroy();
  });

  it('rechecks a concealed prepare so rewind or seek cannot reveal an unapproved passage', async () => {
    let approveSecond;
    const jevConductor = { decide: vi.fn()
      .mockResolvedValueOnce(decision())
      .mockImplementationOnce(() => new Promise(resolve => { approveSecond = resolve; })) };
    const player = new Player(new Session({ atoms: [
      new Atom({ content: 'first', sourceId: 'work', duration: 600000 }),
      new Atom({ content: '', modality: 'text', tags: ['paragraph-break'], duration: 16 }),
      text('second')
    ] }), { jevConductor });
    const emitted = vi.fn();
    player.on('atom', emitted);
    player.play();
    await vi.waitFor(() => expect(emitted).toHaveBeenCalledTimes(1));

    player.sessionState.currentIndex = 2;
    player.currentAtomRemainingTime = null;
    expect(player._prepareCurrentAtom({ concealed: true })).toBe(false);
    expect(emitted).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(jevConductor.decide).toHaveBeenCalledTimes(2));
    approveSecond(decision());
    await vi.waitFor(() => expect(emitted).toHaveBeenCalledTimes(2));
    expect(emitted.mock.calls[1][0].atom.content).toBe('second');
    player.destroy();
  });

  it('preserves legacy synchronous playback when no Jev conductor is supplied', () => {
    const player = new Player(new Session({ atoms: [text('first')] }));
    const atoms = vi.fn();
    player.on('atom', atoms);
    player.play();
    expect(atoms).toHaveBeenCalledTimes(1);
    player.destroy();
  });
});
