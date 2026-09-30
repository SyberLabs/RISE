/**
 * What a participant does, one screen after another: read what this is and
 * agree, meet one condition, answer the questions, and take away a record.
 *
 * It is an instrument, not a study (see src/live/eval/study.js): running it
 * with people needs consent and whatever ethical review applies. It collects
 * nothing that identifies a person, sends nothing anywhere, and keeps nothing
 * in storage; the record exists on this page until it is downloaded.
 *
 * A condition is a presenter: `present({ container, done })` shows the fixed
 * answer in that condition's way and calls `done()` when the participant has
 * finished with it; it returns `{ destroy }`.
 */

import {
    COMPREHENSION, CONDITIONS, conditionFor, ENVIRONMENT_FIELDS, newParticipantId, presentedChoices, RATING_SCALE, RATINGS,
    RECORD_SCHEMA, SECONDARY, validateRecord
} from '../eval/study.js';

const el = (tag, options = {}, ...children) => {
    const node = document.createElement(tag);
    if (options.class) node.className = options.class;
    if (options.text !== undefined) node.textContent = options.text;
    for (const [name, value] of Object.entries(options.attrs ?? {})) node.setAttribute(name, value);
    node.append(...children);
    return node;
};

/** A question as a fieldset of radio buttons, in this participant's order. Its value is the original index. */
function questionField(item, seed, name) {
    const set = el('fieldset', { class: 'live-eval__question' }, el('legend', { text: item.prompt }));
    for (const choice of presentedChoices(item, seed)) {
        const input = el('input', { attrs: { type: 'radio', name, value: String(choice.index) } });
        set.append(el('label', { class: 'live-eval__choice' }, input, ' ', choice.text));
    }
    return set;
}

const chosen = (form, name) => {
    const picked = form.querySelector(`input[name="${name}"]:checked`);
    return picked ? Number(picked.value) : undefined;
};

/** Offer text as a file. Injected in tests. */
export function downloadJson(filename, value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = el('a', { attrs: { href: url, download: filename } });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export class EvalRunner {
    /**
     * @param {HTMLElement} container
     * @param {object} options
     * @param {URLSearchParams} options.params `n` the participant number, `seed` the assignment seed
     * @param {Record<string, (context: object) => {destroy: Function}>} options.presenters one per condition
     * @param {() => object} [options.environment] what the device could do, for the record
     * @param {(filename: string, value: object) => void} [options.download]
     * @param {() => Date} [options.now]
     */
    constructor(container, { params, presenters, environment = () => ({}), download = downloadJson, now = () => new Date() }) {
        this.container = container;
        this.presenters = presenters;
        this.environment = environment;
        this.download = download;
        this.now = now;
        const number = Number(params.get('n'));
        const assigned = params.has('n') && Number.isInteger(number) && number >= 0;
        this.number = assigned ? number : Math.floor(Math.random() * 1_000_000);
        this.balanced = assigned;
        this.condition = conditionFor(this.number, Number(params.get('seed')) || 1);
        this.participantId = newParticipantId();
        this.record = null;
        this.presenting = null;
        this.consent();
    }

    clear() {
        this.presenting?.destroy?.();
        this.presenting = null;
        this.container.replaceChildren();
    }

    screen(heading, ...children) {
        this.clear();
        const main = el('main', { class: 'live-host live-eval', attrs: { 'aria-labelledby': 'live-eval-title' } },
            el('h1', { class: 'live-title', text: heading, attrs: { id: 'live-eval-title' } }), ...children);
        this.container.append(main);
        main.querySelector('h1').setAttribute('tabindex', '-1');
        main.querySelector('h1').focus({ preventScroll: true });
        return main;
    }

    consent() {
        const agree = el('input', { attrs: { type: 'checkbox', id: 'live-eval-agree' } });
        const start = el('button', { class: 'live-start', text: 'Begin', attrs: { type: 'button', disabled: '' } });
        agree.addEventListener('change', () => { start.disabled = !agree.checked; });
        start.addEventListener('click', () => this.begin());
        this.screen('A short study',
            el('p', { class: 'live-lede', text: 'You will be shown one answer, in one of several ways, and then asked what you took from it. It takes about ten minutes. It is testing the way the answer is shown, not you.' }),
            el('ul', { class: 'live-eval__terms' },
                el('li', { text: 'No name or contact details are asked for, and nothing you do here leaves this device.' }),
                el('li', { text: 'At the end you can download a small file of your answers. You may be asked to send it, and to answer a few questions again later.' }),
                el('li', { text: 'You can stop at any time by closing this page. Nothing is kept if you do.' })),
            el('label', { class: 'live-label live-eval__agree' }, agree, ' I have read this and I want to take part.'),
            start);
    }

    begin() {
        this.record = { schema: RECORD_SCHEMA, participantId: this.participantId, condition: this.condition, startedAt: this.now().toISOString(), environment: this.environment() };
        const label = CONDITIONS.find(condition => condition.id === this.condition);
        const start = el('button', { class: 'live-start', text: 'Start', attrs: { type: 'button' } });
        start.addEventListener('click', () => this.present());
        this.screen('Ready',
            el('p', { class: 'live-lede', text: 'The answer will begin when you press Start. Give it your attention as you would any answer you wanted to understand.' }),
            el('p', { class: 'live-eval__note', text: this.balanced ? `Condition ${label.label}.` : 'This run was not assigned by a researcher, so it is not balanced.' }),
            start);
    }

    present() {
        const present = this.presenters[this.condition];
        this.clear();
        const stage = el('div', { class: 'live-eval__stage' });
        this.container.append(stage);
        this.presenting = present({
            container: stage,
            done: () => this.questions(),
            // What the device did, for the record: kept only if it is one of the fields a record may hold.
            note: (key, value) => {
                if (ENVIRONMENT_FIELDS.includes(key)) this.record.environment = { ...this.record.environment, [key]: value };
            }
        });
    }

    questions() {
        const seed = this.participantId;
        const form = el('form', { class: 'live-eval__form', attrs: { novalidate: '' } });
        for (const item of COMPREHENSION) form.append(questionField(item, seed, item.id));
        for (const item of SECONDARY) form.append(questionField(item, seed, item.id));
        const rated = RATINGS.filter(rating => rating.appliesTo.includes(this.condition));
        for (const rating of rated) {
            const set = el('fieldset', { class: 'live-eval__question live-eval__rating' },
                el('legend', { text: rating.prompt }),
                el('p', { class: 'live-eval__note', text: `${RATING_SCALE.min} is ${RATING_SCALE.low.toLowerCase()}, ${RATING_SCALE.max} is ${RATING_SCALE.high.toLowerCase()}.` }));
            for (let value = RATING_SCALE.min; value <= RATING_SCALE.max; value += 1) {
                set.append(el('label', { class: 'live-eval__choice' }, el('input', { attrs: { type: 'radio', name: rating.id, value: String(value) } }), ` ${value}`));
            }
            form.append(set);
        }
        const error = el('p', { class: 'live-error', attrs: { role: 'alert', hidden: '' } });
        const submit = el('button', { class: 'live-start', text: 'Finish', attrs: { type: 'submit' } });
        form.append(error, submit);
        form.addEventListener('submit', event => {
            event.preventDefault();
            const answers = {};
            for (const item of [...COMPREHENSION, ...SECONDARY]) {
                const value = chosen(form, item.id);
                if (value === undefined) { error.textContent = 'Please answer every question. A guess is fine.'; error.hidden = false; return; }
                answers[item.id] = value;
            }
            const ratings = {};
            for (const rating of rated) {
                const value = chosen(form, rating.id);
                if (value === undefined) { error.textContent = 'Please rate every statement.'; error.hidden = false; return; }
                ratings[rating.id] = value;
            }
            this.finish(answers, ratings);
        });
        this.screen('What did you take from it?', form);
    }

    finish(answers, ratings) {
        this.record = validateRecord({ ...this.record, answers, ratings, finishedAt: this.now().toISOString() });
        const save = el('button', { class: 'live-start', text: 'Download my answers', attrs: { type: 'button' } });
        save.addEventListener('click', () => this.download(`rise-study-${this.record.participantId}.json`, this.record));
        this.screen('Thank you',
            el('p', { class: 'live-lede', text: 'Please download your answers and send the file back to whoever asked you to take part. It holds a random code and your answers, and nothing else.' }),
            save,
            el('p', { class: 'live-eval__note', text: 'Later, ideally after a day, they may ask you to answer six of the questions again. You will need the file for that.' }));
    }
}

/** The later questions: open the file, answer the six again, and take away the file with them added. */
export class DelayedRunner {
    constructor(container, { download = downloadJson, now = () => new Date() } = {}) {
        this.container = container;
        this.download = download;
        this.now = now;
        this.open();
    }

    screen(heading, ...children) {
        this.container.replaceChildren();
        const main = el('main', { class: 'live-host live-eval', attrs: { 'aria-labelledby': 'live-eval-title' } },
            el('h1', { class: 'live-title', text: heading, attrs: { id: 'live-eval-title' } }), ...children);
        this.container.append(main);
        return main;
    }

    open() {
        const file = el('input', { attrs: { type: 'file', accept: 'application/json,.json', id: 'live-eval-file' } });
        const error = el('p', { class: 'live-error', attrs: { role: 'alert', hidden: '' } });
        file.addEventListener('change', async () => {
            try {
                const record = validateRecord(JSON.parse(await file.files[0].text()));
                if (record.delayed) throw new RangeError('These questions were already answered.');
                this.ask(record);
            } catch (caught) {
                error.textContent = caught instanceof RangeError ? caught.message.replace(/^Not a study record: /u, 'That file is not one of ours: ') : 'That file could not be read.';
                error.hidden = false;
            }
        });
        this.screen('The later questions',
            el('p', { class: 'live-lede', text: 'Open the file you downloaded, then answer the same six questions again from memory. A guess is fine.' }),
            el('label', { class: 'live-label' }, 'Your file', file), error);
    }

    ask(record) {
        const form = el('form', { class: 'live-eval__form', attrs: { novalidate: '' } });
        const seed = `${record.participantId}:later`;
        for (const item of COMPREHENSION) form.append(questionField(item, seed, item.id));
        const error = el('p', { class: 'live-error', attrs: { role: 'alert', hidden: '' } });
        form.append(error, el('button', { class: 'live-start', text: 'Finish', attrs: { type: 'submit' } }));
        form.addEventListener('submit', event => {
            event.preventDefault();
            const answers = {};
            for (const item of COMPREHENSION) {
                const value = chosen(form, item.id);
                if (value === undefined) { error.textContent = 'Please answer every question. A guess is fine.'; error.hidden = false; return; }
                answers[item.id] = value;
            }
            const done = validateRecord({ ...record, delayed: { answeredAt: this.now().toISOString(), answers } });
            const save = el('button', { class: 'live-start', text: 'Download the updated file', attrs: { type: 'button' } });
            save.addEventListener('click', () => this.download(`rise-study-${done.participantId}.json`, done));
            this.screen('Thank you', el('p', { class: 'live-lede', text: 'Please send the updated file back.' }), save);
        });
        this.screen('The same six questions', form);
    }
}
