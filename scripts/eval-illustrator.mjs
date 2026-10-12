/**
 * The illustrator measurement (docs/plans/LIVE-CURRENT.md §19; the RISE Live design, §6.2 and §8 stage 5.5): asked for a
 * figure, does a real model draw one RISE admits, how many attempts does it take, and how long from request to picture?
 *
 * The brief is put to the model exactly as the venue puts it: through the real OpenRouter adapter
 * (src/live/adapters/openrouter.js), with the illustrator's own instructions, and held to RISE's admission and repaired
 * by the runtime's own loop (src/live/illustrator.js draw), three attempts in all.
 *
 * With OPENROUTER_API_KEY in the environment it bills that account for up to three short answers. The key is read from
 * the environment only, put in the one request header, and never printed or written. Without a key it measures
 * nothing: it says so, runs the same loop against a scripted provider (a refused figure, then the figure repaired) to
 * show the illustrator's instructions and the repair are carried, and exits 0, so CI can run it.
 *
 *   OPENROUTER_API_KEY=… node scripts/eval-illustrator.mjs [--brief "…"] [--model maker/model] [--medium figure|scene]
 */

import { pathToFileURL } from 'node:url';
import { draw, modelMedium } from '../src/live/illustrator.js';
import { createOpenRouterAdapter } from '../src/live/adapters/openrouter.js';
import { ILLUSTRATOR_INSTRUCTIONS } from '../src/live/adapters/openai-instructions.js';
import { OPENROUTER_DEFAULT_MODEL } from '../src/live/adapters/openrouter-model.js';
import { WATER_FIGURE, WATER_FIGURE_REFUSED } from '../src/live/fixtures/water-illustrated-beats.js';
import { createFakeOpenRouterFetch } from '../src/test/fake-openrouter-fetch.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_BRIEF = 'a labelled diagram of the three states of water, with heat moving between them';
/** The room the brief is drawn for: what the venue would send after the composer's first beats. */
const ROOM = Object.freeze({
    theme: 'cobalt',
    running: { id: 'field', engine: 'attractor' },
    said: ['Water comes in three states: ice, liquid water, and steam.', 'Which one you meet depends on how fast its molecules move.']
});

/**
 * @param {object} options
 * @param {{request: (init: object) => Promise<Response>, scrub?: (text: string) => string}} options.chat the connection
 * @param {string} [options.brief]
 * @param {string} [options.model]
 * @param {'figure'|'scene'} [options.medium]
 */
export async function runIllustratorEval({ chat, brief = DEFAULT_BRIEF, model = OPENROUTER_DEFAULT_MODEL, medium = modelMedium(brief) }) {
    const sent = [];
    const usage = [];
    const recording = { ...chat, request: init => { sent.push(JSON.parse(init.body).messages); return chat.request(init); } };
    const adapter = createOpenRouterAdapter({ getChat: () => recording, getModel: () => model, referer: 'https://rise.syberlabs.io', onUsage: report => usage.push(report) });
    const notes = [];
    const started = performance.now();
    const result = await draw({
        adapter, brief, medium, room: ROOM, now: () => performance.now(),
        onNote: (type, body) => notes.push({ at: Math.round(performance.now() - started), type, ...body })
    });
    const total = key => usage.reduce((sum, item) => sum + (item[key] ?? 0), 0);
    return {
        model, brief, medium, result, notes,
        requests: sent.length,
        // The illustrator's own instructions on every request; and on each repair, what was refused and why.
        carried: {
            instructions: sent.every(messages => messages[0].content.startsWith(ILLUSTRATOR_INSTRUCTIONS)),
            repair: sent.slice(1).every(messages => /RISE refused the last picture/u.test(messages[1].content))
        },
        refusals: notes.filter(note => note.type === 'illustration.refused').map(note => `${note.rule}${note.line ? ` at ${note.line}:${note.column}` : ''}`),
        spoke: notes.filter(note => note.type === 'illustrator.spoke').length,
        tokens: { prompt: total('promptTokens'), completion: total('completionTokens'), cost: Math.round(total('cost') * 1e6) / 1e6 }
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
    const { result } = report;
    console.log(`Model: ${report.model}`);
    console.log(`Brief: ${report.brief} (medium ${report.medium})`);
    console.log(`Requests: ${report.requests}; the illustrator's instructions carried on each: ${report.carried.instructions}; the repair carried on each retry: ${report.carried.repair}`);
    for (const note of report.notes) console.log(`  ${String(note.at).padStart(6)} ms  ${note.type}${note.attempt ? ` attempt ${note.attempt}` : ''}${note.rule ? ` (${note.rule}${note.line ? ` line ${note.line}, column ${note.column}` : ''})` : ''}`);
    console.log(`Refusals: ${report.refusals.length ? report.refusals.join(', ') : 'none'}; sentences dropped: ${report.spoke}`);
    if (result.status === 'admitted') console.log(`Admitted: a ${result.medium} on attempt ${result.attempts}, ${Math.round(result.ms)} ms from the first request to the picture admitted`);
    else if (result.status === 'cue') console.log(`Answered with a cue to the running scene on attempt ${result.attempts}: ${JSON.stringify(result.change)}`);
    else console.log(`Not admitted: ${result.reason} after ${result.attempts} attempt(s); the reading would go on without the picture`);
    console.log(`Usage: ${report.tokens.prompt} prompt tokens, ${report.tokens.completion} completion tokens, $${report.tokens.cost}`);
}

async function main() {
    const brief = option('brief') ?? DEFAULT_BRIEF;
    const model = option('model') ?? OPENROUTER_DEFAULT_MODEL;
    const medium = option('medium');
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) {
        console.log('Illustrator measurement SKIPPED: no OPENROUTER_API_KEY in the environment, so no model was asked.');
        console.log('Carriage check on a scripted provider (a figure with a <script>, then the figure repaired), through the real OpenRouter adapter:');
        const fence = svg => `@scene picture svg\n\`\`\`svg\n${svg}\n\`\`\`\n`;
        const fake = createFakeOpenRouterFetch({
            clock: { sleep: () => new Promise(resolve => setImmediate(resolve)) },
            textFor: asked => (/RISE refused the last picture/u.test(asked) ? fence(WATER_FIGURE) : `@say Here is your diagram.\n${fence(WATER_FIGURE_REFUSED)}`)
        });
        const report = await runIllustratorEval({ chat: { request: fake.request }, brief, model, ...(medium ? { medium } : {}) });
        print(report);
        const ok = report.carried.instructions && report.carried.repair && report.result.status === 'admitted' && report.result.attempts === 2;
        console.log(`  the illustrator's instructions, the refusal and its repair were carried, and the repair admitted: ${ok}`);
        return ok ? 0 : 1;
    }
    const report = await runIllustratorEval({ chat: keyedChat(key), brief, model, ...(medium ? { medium } : {}) });
    print(report);
    return report.carried.instructions ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().then(code => { process.exitCode = code; }, error => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
}
