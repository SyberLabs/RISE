/**
 * A narration, its alignment, and a storyboard → an MP4.
 *
 * This is the far end of the pipeline the alignment opened. Given a
 * recording, the script it reads, and a list of where the themes change,
 * it builds an Experience Program whose movements are the themes, whose
 * visual track answers each one, and whose narration track carries the
 * real voice — then hands it to the renderer that already exists.
 *
 * ONE SOURCE PER MOVEMENT. A movement anchors to a source, so the script
 * is cut into one inline source per section. That also makes the narration
 * natural: consecutive atoms sharing a cue are coalesced into a single run
 * by `render/plan.js`, so one cue per section becomes one audio clip
 * spanning it, which is exactly the shape `resolveSpokenClips` wants.
 *
 * THE PACE IS MEASURED, NOT CHOSEN. Each section gets a reading cue whose
 * wpm is that section's real speech rate, taken from the alignment. The
 * renderer paces atoms by wpm and drops the audio in at the run's start, so
 * a section whose atoms run shorter than its audio would cut the voice off
 * mid-sentence. Measured pace keeps the two the same length.
 *
 *   node scripts/build-narration-video.mjs --audio <file> --alignment <json> --out <dir>
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where the themes change, and what answers each one.
 *
 * `atWord` is the first word of the section, read off the alignment. The
 * script names most of these itself — it says "some are fractal flames"
 * over the flames and "there are attractors" over the attractors — so the
 * storyboard is mostly transcription rather than invention.
 */
/**
 * The Astronomy plates, when the project carries them.
 *
 * A `sourced` cue names a collection, and preflight refuses one whose works
 * are not admitted into the job — correctly, since the renderer cannot go
 * and fetch pictures mid-render. Until those bytes are admitted this stands
 * in with the procedural whose figures read closest: slow, circular, and
 * old-looking.
 */
const ASTRONOMY = process.env.RISE_ASTRONOMY === '1'
    ? { kind: 'sourced', collections: ['sci-astronomy'] }
    : { kind: 'procedural', collections: ['ostensoria'] };

/**
 * ATTRACTOR AND GENESIS ARE FIELDS, NOT COLLECTIONS. `VISUAL_FIELD_RENDERERS`
 * is focal, attractor and genesis; naming one in a procedural cue's
 * `collections` is accepted by the validator and then resolves to nothing —
 * the first render put `visual:procedural:shuffled` over eighty-four
 * seconds of black.
 */
const ATTRACTOR = { kind: 'field', renderer: 'attractor', config: {} };
const HARMONOGRAPH = { kind: 'procedural', collections: ['harmonograph'] };
const TURRELL = { kind: 'procedural', collections: ['turrell'] };

/**
 * SIXTEEN, BECAUSE THAT IS THE BUDGET AND SHORTER SECTIONS DRIFT LESS.
 *
 * Audio is dropped at each run's start, so voice and text agree at a
 * boundary and diverge until the next one. Calibration fixes the RATE, but
 * a phrase's rounding still accumulates inside a section — measured at
 * about two seconds sixty seconds into an eighty-four second one. The
 * movement cap is 16, so the long themes are split into several sections
 * that share a visual: the picture does not change, the clock re-syncs.
 */
const STORYBOARD = [
    { atWord: 0, title: 'This is RISE', visual: TURRELL },
    { atWord: 37, title: 'Omnia mutantur', visual: ASTRONOMY },
    { atWord: 71, title: 'Neural networks', visual: { kind: 'procedural', collections: ['neural'] } },
    { atWord: 75, title: 'Fractal flames', visual: { kind: 'procedural', collections: ['fractal'] } },
    { atWord: 84, title: 'A Japanese rock garden', visual: { kind: 'procedural', collections: ['rockgarden'] } },
    { atWord: 142, title: 'Ten-hour playlists', visual: HARMONOGRAPH },
    { atWord: 200, title: 'One of the chosen ones', visual: HARMONOGRAPH },
    { atWord: 265, title: 'Where cybernetics never died', visual: HARMONOGRAPH },
    { atWord: 323, title: 'Equations pretending to be landscapes', visual: { kind: 'field', renderer: 'genesis', config: {} } },
    { atWord: 337, title: 'There are attractors', visual: ATTRACTOR },
    { atWord: 400, title: 'You can change the geometry', visual: ATTRACTOR },
    { atWord: 465, title: 'There is no streak', visual: ATTRACTOR },
    { atWord: 510, title: 'You give them rules', visual: ATTRACTOR },
    { atWord: 549, title: 'Several thousand years later', visual: ASTRONOMY },
    { atWord: 593, title: 'So if something here affects you', visual: ASTRONOMY },
    { atWord: 641, title: 'A garden, or a laboratory', visual: TURRELL }
];

/**
 * How long the last section may hold after its final word.
 *
 * The recording ends on eighteen seconds of music. Counted as part of the
 * closing section it drags that section's measured pace down to 60wpm and
 * leaves the text sitting on screen through an instrumental — so the video
 * closes on the words and lets the tail go.
 */
const CLOSING_TAIL_MS = 2500;

/** The pace a section is read at, in the range the program will accept. */
const clampWpm = value => Math.max(60, Math.min(600, Math.round(value)));

function parseArgs(argv) {
    const args = { audio: null, alignment: null, out: resolve(ROOT, 'dist/narration-video') };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--audio') args.audio = argv[++i];
        else if (argv[i] === '--alignment') args.alignment = argv[++i];
        else if (argv[i] === '--out') args.out = resolve(argv[++i]);
    }
    return args;
}

/** One section's audio, cut at the boundaries the alignment found. */
function cutAudio(audioPath, fromMs, toMs, outPath) {
    execFileSync('ffmpeg', [
        '-v', 'error', '-y',
        '-ss', (fromMs / 1000).toFixed(3),
        '-to', (toMs / 1000).toFixed(3),
        '-i', resolve(audioPath),
        '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le',
        outPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    return readFileSync(outPath);
}

function buildSections(words, startedAtMs, durationMs) {
    return STORYBOARD.map((entry, index) => {
        const from = entry.atWord;
        const to = index + 1 < STORYBOARD.length ? STORYBOARD[index + 1].atWord : words.length;
        const slice = words.slice(from, to);
        const startMs = startedAtMs[from];
        // The section ends where the next begins; the last one runs to the
        // final word's end rather than to the end of the recording, so the
        // musical tail is not mistaken for speech.
        const endMs = to < words.length
            ? startedAtMs[to]
            : startedAtMs[words.length - 1]
                + Math.min(CLOSING_TAIL_MS, slice[slice.length - 1].durationMs);

        // Offsets are rebuilt against THIS section's text, because the
        // narration lane checks every word against the source it names and
        // each section is its own source.
        let cursor = 0;
        const text = slice.map(word => word.text).join(' ');
        const cueWords = slice.map(word => {
            const fromCharacter = cursor;
            cursor += word.text.length + 1;
            return {
                text: word.text,
                fromCharacter,
                toCharacter: fromCharacter + word.text.length,
                durationMs: word.durationMs
            };
        });

        const seconds = Math.max(0.001, (endMs - startMs) / 1000);
        return {
            id: `rise-${String(index + 1).padStart(2, '0')}`,
            title: entry.title,
            visual: entry.visual,
            text,
            words: cueWords,
            startMs,
            endMs,
            wpm: clampWpm((slice.length / seconds) * 60)
        };
    });
}

function buildProgram(sections) {
    const movements = sections.map((section, index) => ({
        id: `m${index + 1}`,
        anchor: { sourceIds: [section.id] },
        data: { index, title: section.title }
    }));
    const visuals = sections.map((section, index) => ({
        id: `v${index + 1}`,
        anchor: { sourceIds: [section.id] },
        cue: section.visual
    }));
    const readings = sections.map((section, index) => ({
        id: `r${index + 1}`,
        anchor: { sourceIds: [section.id] },
        cue: { kind: 'pace', wpm: section.wpm, chunkMode: 'phrase' }
    }));
    const narrations = sections.map((section, index) => ({
        id: `n${index + 1}`,
        anchor: { sourceIds: [section.id] },
        cue: {
            kind: 'spoken',
            voiceAssetId: `${section.id}-voice`,
            words: section.words
        }
    }));

    return {
        schema: 'rise.experience-program.v1',
        id: 'rise-narration-video',
        authority: 'proposed',
        editable: true,
        tracks: [
            { id: 'movements', kind: 'movement', clips: movements },
            // A visual track declares what it shows where no clip reaches.
            // Nothing here is unanchored, but the track has to say so.
            { id: 'visuals', kind: 'visual', fallback: { kind: 'still' }, clips: visuals },
            { id: 'readings', kind: 'reading', clips: readings },
            { id: 'narration', kind: 'narration', clips: narrations }
        ]
    };
}

/**
 * Make the compiler's clock agree with the recording's.
 *
 * A reading cue asks for a pace; it does not get to state a duration. The
 * compiler chunks the text into phrases and gives each one a length, and
 * what comes out is reliably longer than words-divided-by-wpm — measured
 * at 5.5% to 12.3% over across ten sections, because a phrase carries
 * punctuation and a floor that plain arithmetic does not.
 *
 * That error is not a constant offset, it is a RATE error, and inside a
 * section it accumulates: a minute in, the text was eight seconds behind
 * the voice reading it. Audio is dropped in at each run's start, so the
 * two agree at a boundary and drift apart until the next one — and with
 * `maxMovements` at 16 the boundaries cannot simply be made frequent.
 *
 * So the pace is solved for rather than derived. Compile, measure what
 * each section actually took, scale its wpm by the miss, and repeat. Three
 * passes is enough; the residual is what one phrase's rounding is worth.
 */
async function calibrate(sections, program, sources, passes = 3) {
    const { compileSession } = await import('../src/core/session-compiler.js');
    for (let pass = 0; pass < passes; pass++) {
        const compiled = compileSession({
            wpm: 160, chunkMode: 'phrase', curve: 'flat',
            experienceProgram: program, sources
        });
        const actual = new Map();
        for (const atom of compiled.atoms) {
            if (!atom.sourceId) continue;
            actual.set(atom.sourceId, (actual.get(atom.sourceId) || 0) + (atom.duration || 0));
        }
        let worst = 0;
        for (const section of sections) {
            const took = actual.get(section.id);
            if (!took) continue;
            const target = section.endMs - section.startMs;
            const miss = took / target;
            worst = Math.max(worst, Math.abs(miss - 1));
            section.wpm = clampWpm(section.wpm * miss);
        }
        // The cue carries the pace, so the program has to be rebuilt with it.
        program.tracks = buildProgram(sections).tracks;
        console.log(`[video] calibration pass ${pass + 1}: worst section off by `
            + `${(worst * 100).toFixed(1)}%`);
        if (worst < 0.01) break;
    }
    return program;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.audio || !args.alignment) {
        console.error('usage: build-narration-video.mjs --audio <file> --alignment <json> [--out <dir>]');
        process.exitCode = 1;
        return;
    }
    mkdirSync(args.out, { recursive: true });

    const alignment = JSON.parse(readFileSync(resolve(args.alignment), 'utf8'));
    const words = alignment.words;
    let cursor = 0;
    const startedAtMs = words.map(word => { const at = cursor; cursor += word.durationMs; return at; });

    const sections = buildSections(words, startedAtMs, alignment.durationMs);
    console.log(`[video] ${sections.length} sections across ${(alignment.durationMs / 1000).toFixed(1)}s`);
    for (const section of sections) {
        console.log(`  ${section.id} ${((section.endMs - section.startMs) / 1000).toFixed(1).padStart(6)}s `
            + `${String(section.words.length).padStart(4)}w ${String(section.wpm).padStart(4)}wpm  ${section.title}`);
    }

    const voiceBytes = {};
    for (const section of sections) {
        const wav = join(args.out, `${section.id}.wav`);
        voiceBytes[`${section.id}-voice`] = cutAudio(args.audio, section.startMs, section.endMs, wav);
    }

    let program = buildProgram(sections);
    const sources = sections.map(section => ({
        id: section.id, name: section.title, data: section.text
    }));
    program = await calibrate(sections, program, sources);
    for (const section of sections) {
        console.log(`  ${section.id} paced at ${section.wpm}wpm`);
    }

    writeFileSync(join(args.out, 'program.json'), `${JSON.stringify(program, null, 2)}\n`);

    const { renderArtifact } = await import('../src/core/render/artifact.js');
    const { buildKernelRequest } = await import('../src/core/render/kernel-request.js');
    const request = buildKernelRequest({
        program,
        sources,
        sessionInput: { chunkMode: 'phrase' },
        // The social profiles cap a job at 90 seconds, which is a social
        // post rather than a piece. Cinema allows ten minutes at 1080p,
        // which is what a narration of this length needs.
        profileId: 'cinema-landscape-1080',
        projectId: 'rise-narration-video'
    });
    // PREFLIGHT CHECKS THE JOB AGAINST WHAT IS ACTUALLY LOADED. The job
    // hashes each source's text into a snapshot; the inventory has to carry
    // the same hash, or the render refuses on the grounds that the edition
    // it was admitted from is not the edition in hand. Same function, same
    // bytes, so they agree by construction rather than by luck.
    const { contentHashOf } = await import('../src/core/render/hash.js');
    request.inventory = {
        voiceBytes,
        sources: await Promise.all(sections.map(async section => ({
            sourceId: section.id,
            contentHash: await contentHashOf(section.text),
            byteLength: Buffer.byteLength(section.text, 'utf8'),
            characterCount: section.text.length
        })))
    };

    console.log('[video] rendering…');
    const artifact = await renderArtifact(request);
    console.log(`[video] ${artifact.mp4Path}`);
    console.log(`[video] ${artifact.encoded?.width}x${artifact.encoded?.height} `
        + `${artifact.encoded?.codec}`);
}

main().catch(error => {
    console.error(`[video] ${error?.code || ''} ${error?.message || error}`);
    if (error?.details) console.error(JSON.stringify(error.details, null, 2).slice(0, 800));
    process.exitCode = 1;
});
