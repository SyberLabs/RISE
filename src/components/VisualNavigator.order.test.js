/**
 * TWO ROADS INTO THE SAME STATE HAVE TO ARRIVE AT THE SAME STATE.
 *
 * The panel's constraints are few — Fit wants a Gallery, a mask wants Thick
 * and Fit and word timing and a Gallery, glass wants neither a mask nor a Fit
 * word, a border wants Fit — but they are enforced at four of the eighteen
 * places that mutate the selection. So the outcome depends on which control a
 * reader happened to press first: choosing Fit while a Focal is held opens a
 * dialog saying the Focal must be set aside, while enabling that same Focal
 * while Fit is on says nothing and lands in the very state the dialog exists
 * to prevent.
 *
 * This is that question asked of every pair rather than of the one somebody
 * happened to find. Each pair is applied in both orders, from the same start,
 * with any dialog confirmed — a reader who wants both things, asked in either
 * sequence, should be given the same reading.
 *
 * A pair that disagrees is not automatically a bug in the rules; it can be a
 * bug in only one direction asking. Either way the panel is telling a reader
 * two different stories about what is allowed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualNavigator } from './VisualNavigator.js';
import { normalizeWordFill } from '../core/visual-selection.js';

let nav = null;
let settings = null;

const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const node = id => nav.container.querySelector(`.vnav-node[data-id="${id}"]`);

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  settings = { chamberFace: 'literary', fontSize: 'medium' };
  nav = new VisualNavigator(container, {
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: { presentation: 'continuous', sourceFamily: 'procedural', procedural: [] }
    },
    onChange: vi.fn(),
    getSettings: () => settings,
    onSettingChange: (key, value) => { settings[key] = value; },
    // The host applies a text-material transaction; without it Fit is
    // proposed and never lands, and every pair naming it measures nothing.
    // This is what ChamberOrbital.applyTextMaterialTransaction does with the
    // settings half.
    onTextMaterialTransaction: ({ settings: patch = {} }) => {
      Object.assign(settings, patch);
    }
  });
  return nav;
}

function unmount() {
  nav?.destroy();
  nav?.container.remove();
  nav = null;
  settings = null;
}

/**
 * The gestures a reader makes, named by what they ask for.
 *
 * Each one REACHES for its control the way a reader does — walk to the pane,
 * find the chip — and presses only what is actually there and enabled. A
 * control the panel does not offer is not a gesture: the border bench appears
 * only under Fit, and calling its setter directly would measure a road that
 * has no entrance.
 *
 * Grouped by the QUESTION each answers, because two answers to one question
 * are order-dependent by definition and rightly so: a reader who picks Thick
 * and then Literary has picked Literary. What is asked here is whether
 * answering two DIFFERENT questions can depend on which came first.
 */
const walk = (...ids) => {
  for (const id of ids) {
    const step = node(id);
    if (!step) return false;
    click(step);
  }
  return true;
};

const at = (pane, selector) => () => {
  if (!walk(...pane)) return null;
  return nav.container.querySelector(selector);
};

const ACTIONS = [
  { id: 'size:fit', group: 'size', reach: at(['size'], '[data-font-size="fit"]') },
  // The chips carry FONT_SIZE_CHIPS ids ('l'), not the persisted value.
  { id: 'size:large', group: 'size', reach: at(['size'], '[data-font-size="l"]') },
  { id: 'face:thick', group: 'face', reach: at(['face'], '[data-chamber-face="thick"]') },
  { id: 'face:literary', group: 'face', reach: at(['face'], '[data-chamber-face="literary"]') },
  { id: 'field:focal', group: 'field', reach: at(['visual', 'focal'], '[data-action="toggle"]') },
  { id: 'field:klee', group: 'field', reach: at(['visual', 'dynamic', 'klee'], '[data-action="toggle"]') },
  {
    id: 'field:turrell', group: 'field',
    reach: at(['visual', 'gallery', 'gallery-procedural', 'turrell'], '[data-action="toggle"]')
  },
  { id: 'ink:accent', group: 'ink', reach: at(['ink'], '[data-word-fill="accent"]') },
  { id: 'ink:same', group: 'ink', reach: at(['ink'], '[data-word-fill="same"]') },
  { id: 'border:accent', group: 'border', reach: at(['size'], '[data-word-fill-border="accent"]') },
  // A switch is asked FOR a state, not flipped: 'glass:on' means on, whether
  // or not it already was. Flipping would make the gesture mean two different
  // things depending on what came before — which is the very thing under test.
  { id: 'glass:on', group: 'glass', want: true,
    reach: () => nav.container.querySelector('[data-action="glass"]') }
];

/**
 * Press one control and answer whatever it asks.
 *
 * A dialog is the panel telling the reader what a choice would cost. This
 * says yes, because the question is whether a reader who wants BOTH things
 * gets the same reading either way — not whether they can be talked out of
 * one of them in one order and not the other.
 *
 * Returns whether the control was there to press at all.
 */
function perform(action) {
  const control = action.reach();
  if (!control || control.disabled) return { pressed: false, asked: false };
  if (control.type === 'checkbox') {
    const want = action.want ?? !control.checked;
    if (control.checked === want) return { pressed: true, asked: false };
    control.checked = want;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    click(control);
  }
  const primary = nav.container.querySelector('[data-dialog-primary]');
  if (primary) click(primary);
  return { pressed: true, asked: Boolean(primary) };
}

/** Everything a reader would see afterwards, in a comparable shape. */
function snapshot() {
  return JSON.stringify({
    enabled: [...nav.selection.enabled].sort(),
    wordFill: normalizeWordFill(nav.selection.wordFill),
    glass: nav.glassOn(),
    fontSize: settings.fontSize,
    chamberFace: settings.chamberFace
  });
}

function endState(sequence) {
  mount();
  try {
    const steps = sequence.map(action => perform(action));
    return {
      state: snapshot(),
      all: steps.every(step => step.pressed),
      asked: steps.some(step => step.asked)
    };
  } finally {
    unmount();
  }
}

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

describe('the order a reader presses things in', () => {
  // 49 pairs in both orders is 98 mountings of the panel; the default 5s is
  // not the budget for it, and the work is done once for both questions.
  it('does not change where they end up', { timeout: 60_000 }, () => {
    const disagreements = [];
    const undisclosed = [];
    let asked = 0;

    for (let i = 0; i < ACTIONS.length; i += 1) {
      for (let j = i + 1; j < ACTIONS.length; j += 1) {
        const a = ACTIONS[i];
        const b = ACTIONS[j];
        if (a.group === b.group) continue;
        asked += 1;
        const forward = endState([a, b]);
        const backward = endState([b, a]);
        // A control one order never offers is progressive disclosure, not a
        // contradiction — the border bench appears only under Fit, and a
        // reader who has not chosen Fit never sees it to be confused by it.
        if (!forward.all || !backward.all) {
          undisclosed.push(`${a.id} + ${b.id}`);
          continue;
        }
        if (forward.state === backward.state) continue;
        // A DIVERGENCE IS ALLOWED; SILENCE IS NOT.
        //
        // When two orders end differently it is because the panel asked
        // something and the reader answered — keep Fit and set the field
        // aside, or take the field and let Fit go. Those are real choices and
        // they rightly lead different places. What is not allowed is one road
        // stopping to ask while the other drives straight through into the
        // state the first one refused.
        if (!forward.asked || !backward.asked) {
          disagreements.push({
            pair: `${a.id} + ${b.id}`,
            forward: `${forward.asked ? 'asked' : 'SILENT'} → ${forward.state}`,
            backward: `${backward.asked ? 'asked' : 'SILENT'} → ${backward.state}`
          });
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`${disagreements.length} of ${asked} cross-question pairs disagree`
      + ` (${undisclosed.length} not comparable: ${undisclosed.join(', ') || 'none'})`);
    for (const row of disagreements) {
      // eslint-disable-next-line no-console
      console.log(`  ${row.pair}\n    first: ${row.forward}\n    other: ${row.backward}`);
    }

    // Six pairs stood here when this was written, and they were one fault
    // wearing six faces: a rule was consulted when the thing that NEEDS
    // something changed — ink needs a mask, Fit needs a Gallery — and never
    // when the thing that PROVIDES it changed. toggleEnabled asked nothing at
    // all, so a Focal enabled under Fit walked into the state that choosing
    // Fit under a Focal refuses. It asks now, and the six are gone.
    expect(disagreements.map(row => row.pair).sort()).toEqual([]);

    // The other half: a control one order never offers is progressive
    // disclosure, not a contradiction — but it should stay deliberate rather
    // than growing quietly. Border appears only under Fit, because it edges a
    // Fit word and edges nothing else. Glass withdraws under Fit and under a
    // mask, because a Fit word leaves no behind for a frosted plate to sit in.
    for (const pair of undisclosed) {
      expect(pair, `${pair} is withheld for no stated reason`)
        .toMatch(/border:accent|glass:on/);
    }
  });

});
