import { afterEach, expect, it, vi } from 'vitest';
import App from './app.js';
import { resolveJevReading } from './app/jev-reading.js';

const SESSION = {
  text: 'Out of me unworthy and unknown',
  origin: { view: 'portal', icon: '✧', name: 'Home', experience: 'jev' },
  continuation: { kind: 'library-division', workId: 'spoon-river-anthology', entryId: '1', noun: 'entry' }
};
vi.mock('./app/jev-reading.js', () => ({ resolveJevReading: vi.fn(async () => ({ ...SESSION })) }));
afterEach(() => vi.clearAllMocks());

function app(opened = true) {
  const instance = new App();
  instance.handleBeginSession = vi.fn(async () => opened);
  return instance;
}

it('opens a proposed reading as resolved, returning Home', async () => {
  const launched = app();
  const decision = { workId: 'oedipus-rex' };
  await launched.launchJevReading(decision, { firstReadPreview: true });
  expect(resolveJevReading).toHaveBeenCalledWith(decision, null);
  expect(launched.handleBeginSession).toHaveBeenCalledWith({ ...SESSION, firstReadPreview: true });
});

it('opens today\'s exact poem, named a poem, returning where it was opened', async () => {
  const launched = app();
  const decision = { workId: 'spoon-river-anthology' };
  const exact = { entryId: 1, label: 'Anne Rutledge' };
  await launched.launchJevReading(decision, { exact, noun: 'poem', origin: { view: 'today', name: 'Today\'s poem' } });
  expect(resolveJevReading).toHaveBeenCalledWith(decision, exact);
  expect(launched.handleBeginSession).toHaveBeenCalledWith({
    ...SESSION,
    origin: { view: 'today', name: 'Today\'s poem' },
    continuation: { ...SESSION.continuation, noun: 'poem' }
  });
});

it('says so when the reading could not open', async () => {
  await expect(app(false).launchJevReading({ workId: 'x' })).rejects.toThrow('could not be opened');
});
