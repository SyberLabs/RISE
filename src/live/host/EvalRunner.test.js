/**
 * The participant's path through the study instrument.
 *
 * The presenters are fakes here (the real ones are held by presenters.test.js
 * and the browser suite); what is held is the path: what is said before
 * anything begins, that a condition is assigned in balance and shown one way,
 * that the questions are asked in an order that cannot be gamed and stored by
 * their original meaning, that only the study's own fields reach the record,
 * and that nothing is kept or sent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    COMPREHENSION, CONDITION_IDS, conditionFor, RECORD_SCHEMA, SECONDARY, validateRecord
} from '../eval/study.js';
import { DelayedRunner, EvalRunner } from './EvalRunner.js';

let container;
afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    sessionStorage.clear();
});

function fakePresenters() {
    const calls = [];
    const presenters = Object.fromEntries(CONDITION_IDS.map(id => [id, context => {
        calls.push({ id, context });
        context.container.textContent = `presenting ${id}`;
        return { destroy: () => { context.container.replaceChildren(); } };
    }]));
    return { presenters, calls };
}

function mount(search = '?n=0&seed=1', options = {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    const { presenters, calls } = options.presenters ?? fakePresenters();
    const downloads = [];
    const runner = new EvalRunner(container, {
        params: new URLSearchParams(search),
        presenters,
        environment: () => ({ viewport: '1280x800', reducedMotion: false }),
        download: (filename, value) => downloads.push({ filename, value }),
        now: () => new Date('2026-09-29T10:00:00.000Z')
    });
    return { runner, calls, downloads };
}

const $ = selector => container.querySelector(selector);
const $$ = selector => [...container.querySelectorAll(selector)];

function goToQuestions(search) {
    const view = mount(search);
    $('#live-eval-agree').click();
    $('.live-start').click();
    $('.live-start').click();
    return view;
}

function answerAll(form, { right = true, rated = 4 } = {}) {
    for (const item of [...COMPREHENSION, ...SECONDARY]) {
        const inputs = [...form.querySelectorAll(`input[name="${item.id}"]`)];
        const picked = inputs.find(input => (Number(input.value) === item.answer) === right) ?? inputs[0];
        picked.checked = true;
    }
    for (const radio of form.querySelectorAll('.live-eval__rating')) {
        const input = radio.querySelector(`input[value="${rated}"]`);
        input.checked = true;
    }
}

describe('before anything begins', () => {
    it('says what this is, what is kept, and that leaving keeps nothing, and will not begin until agreed to', () => {
        mount();
        const text = container.textContent;
        expect(text).toMatch(/testing the way the answer is shown, not you/u);
        expect(text).toMatch(/No name or contact details/u);
        expect(text).toMatch(/nothing you do here leaves this device/u);
        expect(text).toMatch(/Nothing is kept if you do/u);
        expect($('.live-start').disabled).toBe(true);
        $('#live-eval-agree').click();
        expect($('.live-start').disabled).toBe(false);
        $('#live-eval-agree').click();
        expect($('.live-start').disabled).toBe(true);
    });

    it('moves focus to the heading of each screen, so it is announced', () => {
        mount();
        expect(document.activeElement).toBe($('h1'));
    });
});

describe('the condition', () => {
    it('is the one assigned to the participant number, in balance, and reproducible from the seed', () => {
        for (const n of [0, 1, 2, 3, 4, 9]) {
            const { runner } = mount(`?n=${n}&seed=7`);
            expect(runner.condition, String(n)).toBe(conditionFor(n, 7));
            expect(runner.balanced).toBe(true);
        }
    });

    it('is chosen at random, and said not to be balanced, when a researcher did not assign it', () => {
        const { runner } = mount('');
        expect(CONDITION_IDS).toContain(runner.condition);
        expect(runner.balanced).toBe(false);
        $('#live-eval-agree').click();
        $('.live-start').click();
        expect(container.textContent).toMatch(/not assigned by a researcher, so it is not balanced/u);
        const { runner: junk } = mount('?n=abc');
        expect(junk.balanced).toBe(false);
        expect(mount('?n=-4').runner.balanced).toBe(false);
    });

    it('is shown one way only, and only once the participant presses Start', () => {
        const { calls } = mount('?n=2&seed=1');
        $('#live-eval-agree').click();
        $('.live-start').click();
        expect(calls).toHaveLength(0);
        $('.live-start').click();
        expect(calls).toHaveLength(1);
        expect(calls[0].id).toBe(conditionFor(2, 1));
        expect($('.live-eval__stage').textContent).toBe(`presenting ${conditionFor(2, 1)}`);
    });
});

describe('the questions', () => {
    it('are asked when the condition is done: six about the answer, the source, and where it carried on', () => {
        const { calls } = mount('?n=0&seed=1');
        $('#live-eval-agree').click();
        $('.live-start').click();
        $('.live-start').click();
        calls[0].context.done();
        expect($$('.live-eval__question').filter(node => !node.classList.contains('live-eval__rating'))).toHaveLength(8);
        expect($('h1').textContent).toBe('What did you take from it?');
    });

    it('put the right answer in a different place for different participants, and never label which is right', () => {
        const positions = new Set();
        for (let i = 0; i < 12; i += 1) {
            const view = mount(`?n=${i}&seed=1`);
            view.runner.participantId = `${i.toString(16).padStart(12, '0')}`;
            view.runner.questions();
            const first = $$('.live-eval__question')[0];
            positions.add([...first.querySelectorAll('input')].findIndex(input => Number(input.value) === COMPREHENSION[0].answer));
            expect(first.textContent).not.toMatch(/correct|right answer/iu);
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it('ask for ratings of the imagery only in the conditions that have imagery', () => {
        const byCondition = {};
        for (let n = 0; n < 4; n += 1) {
            const view = mount(`?n=${n}&seed=1`);
            view.runner.questions();
            byCondition[view.runner.condition] = $$('.live-eval__rating').map(node => node.querySelector('input').name);
        }
        expect(byCondition.text).toEqual(['coherence']);
        expect(byCondition.spoken).toEqual(['coherence']);
        expect(byCondition['spoken-visualizer']).toEqual(['coherence', 'informative', 'decorative']);
        expect(byCondition['rise-current']).toEqual(['coherence', 'informative', 'decorative']);
    });

    it('do not let the participant finish with one unanswered, and say so in words', () => {
        const view = mount('?n=0&seed=1');
        view.runner.questions();
        $('form').requestSubmit();
        expect($('.live-error').hidden).toBe(false);
        expect($('.live-error').textContent).toBe('Please answer every question. A guess is fine.');
        expect(view.downloads).toEqual([]);
        for (const item of [...COMPREHENSION, ...SECONDARY]) $(`input[name="${item.id}"]`).checked = true;
        $('form').requestSubmit();
        expect($('.live-error').textContent).toBe('Please rate every statement.');
    });
});

describe('the record', () => {
    it('is valid, holds what the study asks and nothing else, stores answers by what they mean, and is offered as a download', () => {
        const { calls, downloads } = goToQuestions('?n=1&seed=1');
        calls[0].context.note('voice', 'browser');
        calls[0].context.done();
        answerAll($('form'), { right: true, rated: 6 });
        $('form').requestSubmit();
        $('.live-start').click();

        expect(downloads).toHaveLength(1);
        const { filename, value } = downloads[0];
        expect(filename).toMatch(/^rise-study-[0-9a-f]{12}\.json$/u);
        expect(() => validateRecord(value)).not.toThrow();
        expect(value.schema).toBe(RECORD_SCHEMA);
        expect(value.condition).toBe(conditionFor(1, 1));
        expect(value.answers).toEqual({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0, e1: 0, o1: 0 });
        expect(value.environment).toEqual({ viewport: '1280x800', reducedMotion: false, voice: 'browser' });
        expect(value.startedAt).toBe('2026-09-29T10:00:00.000Z');
        expect(value.finishedAt).toBe('2026-09-29T10:00:00.000Z');
        expect(JSON.stringify(value)).not.toMatch(/name|email|@|http/iu);
        expect(container.textContent).toMatch(/random code and your answers, and nothing else/u);
    });

    it('is kept nowhere but this page: no storage, no request', () => {
        const fetched = vi.fn();
        vi.stubGlobal('fetch', fetched);
        const spy = vi.spyOn(Storage.prototype, 'setItem');
        const { calls } = goToQuestions('?n=0&seed=1');
        calls[0].context.done();
        answerAll($('form'));
        $('form').requestSubmit();
        expect(spy).not.toHaveBeenCalled();
        expect(fetched).not.toHaveBeenCalled();
        expect(localStorage.length + sessionStorage.length).toBe(0);
        vi.unstubAllGlobals();
        spy.mockRestore();
    });

    it('will not hold a field the study does not ask for, even if a presenter offers one', () => {
        const { calls, downloads } = goToQuestions('?n=0&seed=1');
        calls[0].context.note('userAgent', 'Mozilla/5.0');
        calls[0].context.note('__proto__', { x: 1 });
        calls[0].context.note('dived', true);
        calls[0].context.done();
        answerAll($('form'));
        $('form').requestSubmit();
        $('.live-start').click();
        expect(downloads[0].value.environment).toEqual({ viewport: '1280x800', reducedMotion: false, dived: true });
        expect(JSON.stringify(downloads[0].value)).not.toContain('Mozilla');
    });
});

describe('the later questions', () => {
    const record = () => validateRecord({
        schema: RECORD_SCHEMA, participantId: 'abcdef012345', condition: 'text', startedAt: '2026-09-29T10:00:00.000Z',
        answers: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0, e1: 0, o1: 0 }, ratings: { coherence: 5 }
    });

    function openDelayed() {
        container = document.createElement('div');
        document.body.appendChild(container);
        const downloads = [];
        const runner = new DelayedRunner(container, { download: (filename, value) => downloads.push({ filename, value }), now: () => new Date('2026-09-30T10:00:00.000Z') });
        return { runner, downloads };
    }
    const give = async text => {
        const input = $('#live-eval-file');
        Object.defineProperty(input, 'files', { value: [{ text: async () => text }], configurable: true });
        input.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0));
    };

    it('asks the same six again for the file it is given, and hands back the file with the answers added', async () => {
        const { downloads } = openDelayed();
        await give(JSON.stringify(record()));
        expect($$('.live-eval__question')).toHaveLength(6);
        for (const item of COMPREHENSION) {
            const inputs = [...$$('.live-eval__question')].flatMap(set => [...set.querySelectorAll(`input[name="${item.id}"]`)]);
            inputs.find(input => Number(input.value) === 1).checked = true;
        }
        $('form').requestSubmit();
        $('.live-start').click();
        expect(downloads).toHaveLength(1);
        const updated = validateRecord(downloads[0].value);
        expect(updated.delayed.answeredAt).toBe('2026-09-30T10:00:00.000Z');
        expect(updated.delayed.answers).toEqual({ c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 1 });
        expect(updated.answers).toEqual(record().answers);
        expect(updated.participantId).toBe('abcdef012345');
    });

    it('will not take a file that is not one of ours, or one already answered, and says why', async () => {
        openDelayed();
        for (const bad of ['not json', '{}', JSON.stringify({ ...record(), email: 'a@b.c' }), JSON.stringify({ ...record(), delayed: { answeredAt: '2026-09-30T10:00:00.000Z', answers: {} } })]) {
            await give(bad);
            expect($('.live-error').hidden, bad.slice(0, 30)).toBe(false);
            expect($('.live-error').textContent.length).toBeGreaterThan(10);
            expect($$('.live-eval__question')).toHaveLength(0);
        }
        await give(JSON.stringify({ ...record(), delayed: { answeredAt: '2026-09-30T10:00:00.000Z', answers: {} } }));
        expect($('.live-error').textContent).toBe('These questions were already answered.');
    });

    it('needs every question answered', async () => {
        const { downloads } = openDelayed();
        await give(JSON.stringify(record()));
        $('form').requestSubmit();
        expect($('.live-error').textContent).toBe('Please answer every question. A guess is fine.');
        expect(downloads).toEqual([]);
    });
});
