import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WITHHELD = 'Not in the launch canon.';

vi.mock('../../core/content-store.js', () => ({
  contentStore: {
    manifest: vi.fn(async () => ({
      works: [
        { id: 'literary-meditations', shelved: true },
        { id: 'sacred-tao-te-ching', shelved: true },
        { id: 'sacred-corpus-hermeticum', shelved: false, withheldReason: WITHHELD }
      ],
      school: [
        { id: 'sun.zarathustra', shelved: true },
        { id: 'mercury.rur', shelved: true }
      ]
    }))
  },
  loadSchoolSections: vi.fn(async () => [
    { name: 'Part I · Zarathustra’s Prologue', content: 'When Zarathustra was thirty years old.' },
    { name: 'Part I · Chapter I: The Three Metamorphoses', content: 'Three metamorphoses of the spirit.' }
  ])
}));

vi.mock('../../content/library.js', () => {
  const meditations = {
    id: 'literary-meditations',
    title: 'Meditations',
    chapterCount: 2,
    getDivisions: async () => ({
      divided: true,
      entries: [{ id: 0, label: 'Book I' }, { id: 1, label: 'Book II' }]
    })
  };
  const tao = {
    id: 'sacred-tao-te-ching',
    title: 'Tao Te Ching',
    chapterCount: 1,
    getDivisions: async () => ({ divided: false, entries: [{ id: 0, label: 'Tao Te Ching' }] })
  };
  return { getTextById: id => [meditations, tao].find(text => text.id === id) };
});

import { School } from './School.js';
import { SCHOOL_CANON } from '../../content/school/canon.js';
import { HOUSES } from '../../content/school/houses.js';
import { recordsOfHouse } from '../../content/school/index.js';
import { clearProgress, markRead } from '../../core/school-progress.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

let container;
let school;
let onSelect;
let onAddressChange;

function mount(options = {}) {
  onSelect = vi.fn();
  onAddressChange = vi.fn();
  school = new School(container, { onSelect, onAddressChange, onNavigate: vi.fn(), ...options });
  return school;
}

const lectern = () => container.querySelector('.school-lectern');
const press = selector => container.querySelector(selector).click();

beforeEach(() => {
  clearProgress();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  school?.destroy();
  container.remove();
  clearProgress();
});

describe('the Mystery School pane', () => {
  it('opens on the Gate: the charter, the Oration, and the seven houses', () => {
    mount();
    expect(lectern().dataset.focus).toBe('gate');
    expect(lectern().textContent).toContain('Oration on the Dignity of Man');
    expect(lectern().querySelectorAll('[data-focus]').length).toBeGreaterThanOrEqual(HOUSES.length);
    for (const house of HOUSES) expect(lectern().textContent).toContain(house.name);
  });

  it('draws every text, every house and the Gate on the Wheel as real buttons', () => {
    mount();
    const points = container.querySelectorAll('.school-wheel button[data-record]');
    expect(points.length).toBe(SCHOOL_CANON.length);
    expect(container.querySelectorAll('.school-wheel button[data-house]').length).toBe(HOUSES.length);
    expect(container.querySelector('.school-wheel button[data-gate]')).not.toBeNull();
    const meditations = container.querySelector('[data-record="sun.meditations"]');
    expect(meditations.getAttribute('aria-label')).toBe('Meditations, Marcus Aurelius, House of the Logos, Threshold, Not yet carried');
    expect(meditations.style.left).toMatch(/%$/);
  });

  it('lists every text of the canon across the houses and the Gate', () => {
    mount();
    const listed = new Set(['gate.oration']);
    for (const house of HOUSES) {
      press(`.school-wheel [data-house="${house.id}"]`);
      expect(lectern().dataset.focus).toBe(house.id);
      for (const record of recordsOfHouse(house.id)) {
        expect(lectern().querySelector(`[data-focus="${record.id}"]`), record.id).not.toBeNull();
        listed.add(record.id);
      }
    }
    expect(listed.size).toBe(SCHOOL_CANON.length);
  });

  it('opens a text from its house, with its why, edition, rights, bridges and paths', () => {
    mount();
    press('.school-wheel [data-house="sun"]');
    press('.school-lectern [data-focus="sun.monadology"]');
    const text = lectern().textContent;
    expect(lectern().dataset.focus).toBe('sun.monadology');
    expect(text).toContain('Mind as perspective');
    expect(text).toContain('Robert Latta, 1898');
    expect(text).toContain('Public domain');
    expect(text).toContain('Core · House of the Logos');
    expect(lectern().querySelector('[data-focus="mercury"]')).not.toBeNull();
    expect(lectern().querySelector('[data-focus="path-ghosts"]')).not.toBeNull();
  });

  it('writes the focus into the address in place', () => {
    mount();
    press('.school-wheel [data-house="saturn"]');
    expect(onAddressChange).toHaveBeenLastCalledWith({ focus: 'saturn' });
    press('.school-wheel [data-record="saturn.zhuangzi"]');
    expect(onAddressChange).toHaveBeenLastCalledWith({ focus: 'saturn.zhuangzi' });
    press('.school-wheel [data-gate]');
    expect(onAddressChange).toHaveBeenLastCalledWith({ focus: null });
  });

  it('opens at the focus the address names', () => {
    mount({ initialFocus: 'sun.meditations' });
    expect(lectern().dataset.focus).toBe('sun.meditations');
  });

  it('falls back to the Gate for a focus it does not know', () => {
    mount({ initialFocus: 'pluto' });
    expect(lectern().dataset.focus).toBe('gate');
  });
});

describe('the action a text offers', () => {
  it('reads a served text, whole or by division', async () => {
    mount({ initialFocus: 'sun.meditations' });
    await settle();
    expect(container.querySelector('[data-record="sun.meditations"]').dataset.state).toBe('readable');
    const read = lectern().querySelector('button[data-read]');
    expect(read.textContent.trim()).toBe('Read');
    read.click();
    expect(onSelect).toHaveBeenCalledWith({ recordId: 'sun.meditations', entryIndex: null });
    await settle();
    const book2 = [...lectern().querySelectorAll('button[data-read]')]
      .find(button => button.textContent.includes('Book II'));
    expect(book2.textContent.trim()).toBe('Read · Book II');
    book2.click();
    expect(onSelect).toHaveBeenLastCalledWith({ recordId: 'sun.meditations', entryIndex: 1 });
  });

  it('reads a School corpus text by its declared units, naming the edition used and its rights', async () => {
    mount({ initialFocus: 'sun.zarathustra' });
    await settle();
    await settle();
    expect(container.querySelector('[data-record="sun.zarathustra"]').dataset.state).toBe('readable');
    const facts = lectern().querySelector('.school-facts').textContent;
    expect(facts).toContain('Thomas Common, 1909, via Standard Ebooks');
    expect(facts).toContain('Public domain');
    expect(facts).not.toContain('in copyright');
    const units = [...lectern().querySelectorAll('button[data-entry]')].map(button => button.textContent.trim());
    expect(units).toEqual(['Read · Part I · Zarathustra’s Prologue', 'Read · Part I · Chapter I: The Three Metamorphoses']);
    lectern().querySelectorAll('button[data-entry]')[1].click();
    expect(onSelect).toHaveBeenLastCalledWith({ recordId: 'sun.zarathustra', entryIndex: 1 });
  });

  it('says where a corpus text is still in copyright', async () => {
    mount({ initialFocus: 'mercury.rur' });
    await settle();
    expect(lectern().querySelector('.school-facts').textContent)
      .toContain('Public domain in the US; in copyright in life+70 countries until 2041');
  });

  it('shows a withheld text as not served, with the archive reason', async () => {
    mount({ initialFocus: 'saturn.corpus-hermeticum' });
    await settle();
    const button = lectern().querySelector('.school-action button');
    expect(button.disabled).toBe(true);
    expect(button.textContent.trim()).toBe('Not served yet');
    expect(lectern().textContent).toContain(WITHHELD);
    expect(container.querySelector('[data-record="saturn.corpus-hermeticum"]').dataset.state).toBe('carried');
  });

  it('points an absent text to its free edition outside RISE', async () => {
    mount({ initialFocus: 'sun.fragments' });
    await settle();
    const link = lectern().querySelector('.school-action a');
    expect(link.getAttribute('href')).toBe(
      `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent('Fragments Heraclitus')}`
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.textContent).toContain('Find the free edition');
    expect(link.textContent).toContain('outside RISE');
  });

  it('gives an original-language-only text no outward link', async () => {
    mount({ initialFocus: 'gate.oration' });
    await settle();
    expect(lectern().querySelector('.school-action a')).toBeNull();
    expect(lectern().textContent).toContain('Original language only');
    expect(lectern().textContent).toContain('Latin, orig. only');
  });
});

describe('paths', () => {
  it('chooses a path from its chip, and Escape clears it', () => {
    mount();
    const chip = container.querySelector('[data-path="ficino"]');
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(lectern().dataset.focus).toBe('path-ficino');
    expect(lectern().textContent).toContain('The Ficino Path');
    expect(container.querySelector('[data-record="sun.enneads"]').classList.contains('is-lit')).toBe(true);
    expect(container.querySelector('[data-record="sun.ethics"]').classList.contains('is-lit')).toBe(false);
    expect(container.querySelector('.school-path-line').hasAttribute('hidden')).toBe(false);

    expect(school.handleEscape()).toBe(true);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.school-path-line').hasAttribute('hidden')).toBe(true);
    expect(school.handleEscape()).toBe(false);
  });

  it('clears a path when its chip is chosen again', () => {
    mount();
    press('[data-path="unsaid"]');
    press('[data-path="unsaid"]');
    expect(container.querySelector('[data-path="unsaid"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('opens a path the router names', () => {
    mount();
    school.update({ focus: 'path-ficino' });
    expect(lectern().dataset.focus).toBe('path-ficino');
    expect(container.querySelector('[data-path="ficino"]').getAttribute('aria-pressed')).toBe('true');
    const steps = [...lectern().querySelectorAll('.school-step')];
    expect(steps.length).toBe(5);
    expect(steps[1].textContent).toContain('Poimandres');
  });

  it('offers Read on the first readable step only', async () => {
    mount({ initialFocus: 'path-unsaid' });
    await settle();
    const read = lectern().querySelectorAll('button[data-read]');
    expect(read.length).toBe(1);
    read[0].click();
    expect(onSelect).toHaveBeenCalledWith({ recordId: 'saturn.tao-te-ching', entryIndex: null });
    school.update({ focus: 'path-ghosts' });
    expect(lectern().querySelectorAll('button[data-read]').length).toBe(0);
  });

  it('lists no divisions for an undivided text', async () => {
    mount({ initialFocus: 'saturn.tao-te-ching' });
    await settle();
    await settle();
    expect(lectern().querySelectorAll('.school-division').length).toBe(0);
    expect(lectern().querySelectorAll('button[data-read]').length).toBe(1);
  });
});

describe('the reader’s record', () => {
  it('shows what has been read once the pane is shown again', async () => {
    mount({ initialFocus: 'sun' });
    await settle();
    expect(lectern().textContent).toContain('0 of 8 read');
    markRead('sun.meditations', null);
    school.activate();
    expect(container.querySelector('[data-record="sun.meditations"]').dataset.state).toBe('read');
    expect(lectern().textContent).toContain('1 of 8 read');
  });

  it('marks a read division in the text’s list', async () => {
    markRead('sun.meditations', '1');
    mount({ initialFocus: 'sun.meditations' });
    await settle();
    await settle();
    const book2 = [...lectern().querySelectorAll('.school-division')]
      .find(row => row.textContent.includes('Book II'));
    expect(book2.classList.contains('is-read')).toBe(true);
    expect(container.querySelector('[data-record="sun.meditations"]').dataset.state).toBe('begun');
    expect(container.querySelector('[data-record="sun.meditations"]').getAttribute('aria-label')).toMatch(/, Begun$/);
  });

  it('haloes a house whose arcanum is held', () => {
    markRead('saturn.sermons', null);
    mount();
    expect(container.querySelector('.school-wheel [data-house="saturn"]').classList.contains('is-arcanum')).toBe(true);
    expect(container.querySelector('[data-record="saturn.sermons"]').dataset.state).toBe('arcanum');
  });
});

describe('motion and teardown', () => {
  it('stills the turning rings under either reduced-motion switch', () => {
    const css = readFileSync('src/components/library/School.css', 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/\.reduced-motion \.school-rings/);
  });

  it('leaves nothing behind', () => {
    mount();
    school.destroy();
    expect(container.innerHTML).toBe('');
    school = null;
  });
});

describe('the Wheel on a phone', () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  function phone(matches) {
    const listeners = [];
    window.matchMedia = vi.fn(query => ({
      get matches() { return query === '(max-width: 480px)' ? matches() : false; },
      addEventListener: (_type, listener) => listeners.push(listener),
      removeEventListener() {}
    }));
    return () => listeners.forEach(listener => listener());
  }

  it('makes the text points ink only, leaving the Gate and the houses to press', () => {
    phone(() => true);
    mount();
    for (const point of container.querySelectorAll('.school-point[data-record]:not([data-gate])')) {
      expect(point.getAttribute('tabindex'), point.dataset.record).toBe('-1');
      expect(point.getAttribute('aria-hidden'), point.dataset.record).toBe('true');
    }
    const gate = container.querySelector('[data-gate]');
    expect(gate.hasAttribute('tabindex')).toBe(false);
    expect(gate.hasAttribute('aria-hidden')).toBe(false);
    expect(container.querySelector('[data-house="sun"]').hasAttribute('aria-hidden')).toBe(false);
  });

  it('gives the points back when the screen widens', () => {
    let narrow = true;
    const change = phone(() => narrow);
    mount();
    narrow = false;
    change();
    const point = container.querySelector('[data-record="sun.meditations"]');
    expect(point.hasAttribute('tabindex')).toBe(false);
    expect(point.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('the degree numerals', () => {
  it('are HTML set on each ring at the top, not text scaled with the drawing', () => {
    mount();
    expect(container.querySelector('svg text')).toBeNull();
    const numerals = [...container.querySelectorAll('.school-wheel .school-numeral')];
    expect(numerals.map(numeral => numeral.textContent)).toEqual(['I', 'II', 'III']);
    expect(numerals.every(numeral => numeral.style.left === '50%')).toBe(true);
  });
});

describe('a press on the drawing itself', () => {
  it('changes nothing: only the buttons over it choose', () => {
    mount({ initialFocus: 'sun' });
    press('[data-path="ficino"]');
    container.querySelector('.school-wheel').click();
    expect(container.querySelector('.school-chip[data-path="ficino"]').getAttribute('aria-pressed')).toBe('true');
    expect(lectern().dataset.focus).toBe('path-ficino');
    press('.school-wheel [data-gate]');
    container.querySelector('.school-svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(lectern().dataset.focus).toBe('gate');
    expect(onAddressChange).toHaveBeenCalledTimes(2);
  });
});
