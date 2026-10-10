/**
 * The perception measurement (docs/evals/perception/PERCEPTION-EVAL.md; the RISE Live design, §8 stage 4):
 * does a model change what it says when told the reader replayed?
 *
 * The same question is asked three times through the real OpenRouter adapter (src/live/adapters/openrouter.js), so
 * the request is exactly the one the venue sends:
 *   1. baseline   the question alone
 *   2. control    the question alone again, to measure how much two plain answers differ by chance
 *   3. perceived  the question with the reader's actions: "replayed passage 3 twice", quoting passage 3 of the
 *                 baseline answer, built by perception.js from a journal as the venue builds it
 * and passage 3 of each answer is compared, word by word, with the baseline's.
 *
 * With OPENROUTER_API_KEY in the environment it bills that account for three short answers. The key is read from
 * the environment only, put in the one request header, and never printed or written. Without a key it measures
 * nothing: it says so, runs the same three requests against a scripted provider to show the block is carried on
 * the third alone, and exits 0, so CI can run it.
 *
 *   OPENROUTER_API_KEY=… node scripts/eval-perception.mjs [--question "…"] [--model maker/model]
 */

import { pathToFileURL } from 'node:url';
import { createCurrentStream } from '../src/live/stream.js';
import { describePerception, perceive } from '../src/live/perception.js';
import { createOpenRouterAdapter } from '../src/live/adapters/openrouter.js';
import { OPENROUTER_DEFAULT_MODEL } from '../src/live/adapters/openrouter-model.js';
import { sceneRefusal } from '../src/core/scene-admission.js';
import { BLACK_HOLES_BEATS_TEXT } from '../src/live/fixtures/black-holes-beats.js';
import { createFakeOpenRouterFetch } from '../src/test/fake-openrouter-fetch.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_QUESTION = 'Explain black holes.';
/** The passage the reader is said to have replayed, counted as the reader sees passages: those with words. */
const PASSAGE = 3;

const words = text => String(text ?? '').toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

/** How much of two texts' vocabulary is shared, 0 to 1 (Jaccard over lower-cased words); 0 when either is missing. */
export function wordSimilarity(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return 0;
    const left = new Set(words(a));
    const right = new Set(words(b));
    if (left.size === 0 && right.size === 0) return 1;
    let shared = 0;
    for (const word of left) if (right.has(word)) shared += 1;
    return Math.round((shared / (left.size + right.size - shared)) * 1000) / 1000;
}

/** One answer, read to its end through the adapter as the venue reads one: its passages with words, in order. */
async function ask(adapter, request) {
    const connection = await adapter.open(request);
    const stream = createCurrentStream({ admitScene: adapter.admitScene ?? sceneRefusal });
    try {
        for await (const event of connection.events) stream.apply(event);
    } catch { /* the stream says how it ended */ }
    await connection.close();
    const view = stream.snapshot();
    const passages = view.segments.filter(segment => segment.ended && segment.text.trim()).map(segment => ({ segmentId: segment.id, text: segment.text }));
    return { phase: view.phase, error: view.error, origin: view.origin, passages };
}

const passage = (answer, n) => answer.passages[n - 1]?.text ?? null;

/**
 * @param {object} options
 * @param {{request: (init: object) => Promise<Response>, scrub?: (text: string) => string}} options.chat the connection
 * @param {string} [options.question]
 * @param {string} [options.model]
 */
export async function runPerceptionEval({ chat, question = DEFAULT_QUESTION, model = OPENROUTER_DEFAULT_MODEL }) {
    const sent = [];
    const recording = { ...chat, request: init => { sent.push(JSON.parse(init.body).messages[1].content); return chat.request(init); } };
    const adapter = createOpenRouterAdapter({ getChat: () => recording, getModel: () => model, referer: 'https://rise.syberlabs.io' });

    const baseline = await ask(adapter, { intent: 'answer', prompt: question });
    const control = await ask(adapter, { intent: 'answer', prompt: question });
    const target = baseline.passages[PASSAGE - 1];
    if (!target) throw new Error(`The baseline answer has ${baseline.passages.length} passages with words; passage ${PASSAGE} is needed`);
    // The journal the venue keeps when a reader presses Replay twice in passage 3, and what perception makes of it.
    const journal = [1, 2].map(at => ({ at, type: 'replay', from: target.segmentId, to: target.segmentId, reason: 'reader' }));
    const perception = perceive(journal, { passages: baseline.passages });
    const block = describePerception(perception);
    const perceived = await ask(adapter, { intent: 'answer', prompt: question, perception });

    const texts = { baseline: passage(baseline, PASSAGE), control: passage(control, PASSAGE), perceived: passage(perceived, PASSAGE) };
    const whole = answer => answer.passages.map(item => item.text).join(' ');
    const similarity = { control: wordSimilarity(texts.baseline, texts.control), perceived: wordSimilarity(texts.baseline, texts.perceived) };
    const changed = texts.perceived !== texts.baseline;
    const verdict = !changed
        ? `passage ${PASSAGE} unchanged: the answer told the reader replayed it says it in the same words`
        : similarity.perceived < similarity.control
            ? `passage ${PASSAGE} changed more with the reader's actions (similarity ${similarity.perceived}) than between two plain answers (${similarity.control})`
            : `passage ${PASSAGE} changed, but no more than two plain answers differ by chance (${similarity.perceived} with the actions, ${similarity.control} without)`;
    return {
        model, question, passage: PASSAGE, block,
        carried: { baseline: sent[0] !== question, control: sent[1] !== question, perceived: sent[2] === `${block}\n\nThen the reader asked: ${question}` },
        origin: perceived.origin,
        phases: { baseline: baseline.phase, control: control.phase, perceived: perceived.phase },
        passage3: texts,
        similarity,
        wholeSimilarity: { control: wordSimilarity(whole(baseline), whole(control)), perceived: wordSimilarity(whole(baseline), whole(perceived)) },
        passages: { baseline: baseline.passages.length, control: control.passages.length, perceived: perceived.passages.length },
        perceivedAnswer: perceived.passages.map(item => item.text),
        changed,
        verdict
    };
}

/** The reader's own connection, as ai-connection.js makes one in the browser: the key goes in the header and nowhere else. */
function keyedChat(key) {
    return {
        request: init => fetch(OPENROUTER_CHAT_URL, { ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` } }),
        scrub: text => String(text).split(key).join('[key]')
    };
}

function option(name) {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
}

function print(report) {
    console.log(`Model: ${report.model}${report.origin ? ` (the Current says: ${report.origin.name} via ${report.origin.provider})` : ''}`);
    console.log(`Question: ${report.question}`);
    console.log(`Answers: ${report.phases.baseline}, ${report.phases.control}, ${report.phases.perceived}; passages with words ${report.passages.baseline}, ${report.passages.control}, ${report.passages.perceived}`);
    console.log(`The block carried on the third request only: ${report.carried.perceived && !report.carried.baseline && !report.carried.control}`);
    console.log('\nThe block:\n' + report.block);
    for (const which of ['baseline', 'control', 'perceived']) console.log(`\nPassage ${report.passage}, ${which}: ${report.passage3[which] ?? '(none)'}`);
    console.log(`\nWord similarity to the baseline's passage ${report.passage}: control ${report.similarity.control}, with the actions ${report.similarity.perceived}`);
    console.log(`Whole-answer similarity to the baseline: control ${report.wholeSimilarity.control}, with the actions ${report.wholeSimilarity.perceived}`);
    console.log('\nThe answer given the actions, passage by passage:');
    report.perceivedAnswer.forEach((text, index) => console.log(`  ${index + 1}. ${text}`));
    console.log(`\nVerdict: ${report.verdict}`);
}

async function main() {
    const question = option('question') ?? DEFAULT_QUESTION;
    const model = option('model') ?? OPENROUTER_DEFAULT_MODEL;
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) {
        console.log('Perception measurement SKIPPED: no OPENROUTER_API_KEY in the environment, so no model was asked.');
        console.log('Carriage check on a scripted provider (the same answer whatever it is told), through the real OpenRouter adapter:');
        const fake = createFakeOpenRouterFetch({ clock: { sleep: () => new Promise(resolve => setImmediate(resolve)) }, textFor: () => BLACK_HOLES_BEATS_TEXT });
        const report = await runPerceptionEval({ chat: { request: fake.request }, question, model });
        const carried = report.carried.perceived && !report.carried.baseline && !report.carried.control;
        console.log(`  the block went up on the third request and not the first two: ${carried}`);
        console.log(report.block.split('\n').map(line => `  ${line}`).join('\n'));
        return carried ? 0 : 1;
    }
    const report = await runPerceptionEval({ chat: keyedChat(key), question, model });
    print(report);
    return report.carried.perceived && !report.carried.baseline && !report.carried.control ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().then(code => { process.exitCode = code; }, error => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
}
