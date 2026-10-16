// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('./app/school-reading.js', () => ({
  schoolReading: vi.fn(async recordId => (recordId === 'sun.meditations'
    ? { text: 'Book II text', source: 'Meditations · Book II', config: { wpm: 200 }, origin: { view: 'school', icon: '☉', name: 'Mystery School' } }
    : null))
}));

import App from './app.js';
import { schoolReading } from './app/school-reading.js';

function shell() {
  return {
    router: { navigate: vi.fn() },
    showToast: vi.fn(),
    handleTextSelection: App.prototype.handleTextSelection
  };
}

describe('opening a text in Reader setup', () => {
  it('keeps the Library as the origin when none is named', () => {
    const app = shell();
    app.handleTextSelection('Text', 'Source', { wpm: 180 });
    expect(app.router.navigate).toHaveBeenCalledWith('chamber', {
      data: { text: 'Text', source: 'Source', config: { wpm: 180, origin: { view: 'library', icon: '◇', name: 'Library' } } }
    });
  });

  it('opens a Mystery School text with the school as its origin', async () => {
    const app = shell();
    await App.prototype.selectSchoolText.call(app, { recordId: 'sun.meditations', entryIndex: 1 });
    expect(schoolReading).toHaveBeenCalledWith('sun.meditations', 1);
    expect(app.router.navigate).toHaveBeenCalledWith('chamber', {
      data: {
        text: 'Book II text',
        source: 'Meditations · Book II',
        config: { wpm: 200, origin: { view: 'school', icon: '☉', name: 'Mystery School' } }
      }
    });
  });

  it('says so, and goes nowhere, when the school text cannot be opened', async () => {
    const app = shell();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await App.prototype.selectSchoolText.call(app, { recordId: 'sun.fragments', entryIndex: null });
    expect(app.router.navigate).not.toHaveBeenCalled();
    expect(app.showToast).toHaveBeenCalledWith('This work could not be opened. Try again.', 4000);
  });
});
