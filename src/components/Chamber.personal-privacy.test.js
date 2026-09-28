import { it, expect, vi } from 'vitest';
import { Chamber } from './Chamber.js';

it('does not log the reading title or prose during construction or atom display', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const container = document.createElement('div'); document.body.append(container);
  const chamber = new Chamber(container, {
    session: { title: 'PRIVATE TITLE', atoms: [{ content: 'PRIVATE PROSE', duration: 500 }], totalDuration: 500, atomCount: 1, visualConfig: { visualMode: 'off' } },
    player: null, autoStart: false, getSettings: () => ({})
  });
  try {
    chamber.displayAtom(chamber.session.atoms[0]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE');
  }
  finally { chamber.destroy(); container.remove(); log.mockRestore(); }
});
