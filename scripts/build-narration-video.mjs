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
import { SEQUENCE_ASSET_PREFIX } from '../src/core/visual-score-lane.js';
import { validateExperienceProgram } from '../src/core/experience-program.js';

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
 * The Astronomy plates: one named work per section.
 *
 * A `sourced` cue naming the COLLECTION leaves the choice to the gallery
 * wall, and the wall restarts at index 0 on every run — three sections
 * would show the same opening plate, and the credit block would have to
 * name all 216 works in case any of them appeared. A cue naming
 * `sequence-asset:<id>` pins exactly one, so what is admitted, what is
 * seen and what is credited are the same three works.
 *
 * The storyboard is the only list: registering the cue is what puts a
 * work up for admission, so a plate cannot be shown without being
 * credited, or credited without being shown.
 */
const assetIdFor = workId => `astro-${String(workId).replace(/[^a-z0-9]+/gi, '-')}`;

const astronomyWorkIds = new Map();
const astronomyCue = (workId) => {
    astronomyWorkIds.set(assetIdFor(workId), workId);
    return { kind: 'sourced', collections: [`${SEQUENCE_ASSET_PREFIX}${assetIdFor(workId)}`] };
};

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
const FRACTAL = { kind: 'procedural', collections: ['fractal'] };
const ROCKGARDEN = { kind: 'procedural', collections: ['rockgarden'] };
const NEURAL = { kind: 'procedural', collections: ['neural'] };
const GENESIS = { kind: 'field', renderer: 'genesis', config: {} };

/** Iris Plates. `ostensoria` is the engine id; Verdant is one of its ramps. */
const IRIS_VERDANT = { kind: 'procedural', collections: ['ostensoria'], config: { palette: 'verdant' } };

/** Spectral Plates: an upright apparition on a mirror axis. */
const SPECTRAL = { kind: 'procedural', collections: ['apparitio'] };

/**
 * SIXTEEN MOVEMENTS IS THE BUDGET; A SECTION IS NOW A PICTURE, NOT A CLOCK.
 *
 * These used to be cut short because a section drifted: audio drops at each
 * run's start, so voice and text agreed at a boundary and diverged until
 * the next, and long themes had to be split into several sections sharing
 * one visual purely so the clock could re-sync. Retiming atoms from the
 * recording's own word timings ended that - drift is 0ms whatever the
 * length - so the splits that bought nothing but a re-sync are gone, and
 * the movements they were spending now buy different pictures instead.
 */
const STORYBOARD = [
    { atWord: 0, title: 'This is RISE', visual: FRACTAL },
    { atWord: 37, title: 'Omnia mutantur', visual: astronomyCue('esahubble:heic1501a') },
    { atWord: 67, title: 'Some of these are neural networks', visual: NEURAL },
    { atWord: 73, title: 'Some are fractal flames', visual: FRACTAL },
    // The rock garden has to be ON SCREEN for the sentence that names it,
    // not arrive on the words "rock garden" three phrases later — and then
    // give way, because it is the sparsest surface here and the script has
    // already moved on by "Liberally suggestive."
    { atWord: 77, title: 'Inspired by a Japanese rock garden', visual: ROCKGARDEN },
    { atWord: 88, title: 'Not in any particular way', visual: IRIS_VERDANT },
    { atWord: 142, title: 'Ten-hour playlists', visual: HARMONOGRAPH },
    { atWord: 226, title: 'A little place on the internet', visual: HARMONOGRAPH },
    { atWord: 323, title: 'Equations pretending to be landscapes', visual: GENESIS },
    { atWord: 337, title: 'There are attractors', visual: ATTRACTOR },
    { atWord: 480, title: 'Maybe you read differently', visual: SPECTRAL },
    { atWord: 510, title: 'You give them rules', visual: ATTRACTOR },
    { atWord: 549, title: 'Several thousand years later', visual: astronomyCue('esahubble:heic0406a') },
    { atWord: 593, title: 'So if something here affects you', visual: astronomyCue('esahubble:potw1345a') },
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

/**
 * Fetch each pinned plate and admit it as inventory bytes.
 *
 * The renderer cannot go and fetch pictures mid-render — that is the whole
 * reason preflight refuses an unpinned collection — so the bytes have to
 * be in hand before the job is built. This is a build script on a
 * workstation, so fetching here is fine; nothing about it reaches the
 * browser bundle.
 *
 * THE CREDIT COMES FROM THE CATALOG, NOT FROM HERE. `requiredCredit` was
 * composed once at harvest by the same function the chip uses. Recomposing
 * it would put a second author of credit lines in the codebase.
 */
async function admitAstronomy() {
    const { contentHashOfBytes } = await import('../src/core/render/hash.js');
    const catalog = JSON.parse(readFileSync(
        resolve(ROOT, 'src/sources/visual/science-catalog.generated.json'), 'utf8'));
    const byId = new Map(catalog.works.map(work => [work.id, work]));

    const assets = [];
    const declared = [];
    const credits = [];
    for (const [assetId, workId] of astronomyWorkIds) {
        const work = byId.get(workId);
        if (!work) throw new Error(`${workId} is not in the science catalog`);
        if (!work.requiredCredit) throw new Error(`${workId} carries no requiredCredit`);

        const response = await fetch(work.image);
        if (!response.ok) throw new Error(`${work.image} -> HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());

        assets.push({
            assetId,
            contentHash: await contentHashOfBytes(bytes),
            kind: 'image',
            mimeType: 'image/jpeg',
            byteLength: bytes.length,
            // `dataUrl`, not `bytes`: preflight's inventory schema is
            // closed, and it re-decodes this to check the length and hash
            // admitted above against the actual pixels. The three have to
            // agree or the render refuses, which is the point.
            dataUrl: `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`,
            // Rights were settled at harvest and the licence is CC BY 4.0 or
            // public domain with credit; both allow distribution once the
            // credit travels. Where it travels is the caller's problem, and
            // the credit block below is what it travels as.
            rights: { status: 'verified', distributionAllowed: true, credit: work.requiredCredit }
        });
        // The session validates a `sequence-asset:` cue against what the
        // reading declares it carries, separately from what the render
        // job admits. Both lists are built from the same fetch, so they
        // cannot disagree about a plate's id, type or size.
        declared.push({
            id: assetId,
            kind: 'image',
            name: work.title,
            storage: 'idb',
            mimeType: 'image/jpeg',
            byteLength: bytes.length
        });
        // The title is quoted because a title may itself contain the dash
        // this line separates on — "…Pillars of Creation — visible" read as
        // two works joined by one credit.
        credits.push(`"${work.title}" — ${work.requiredCredit}`);
        console.log(`[video] admitted ${assetId} `
            + `${(bytes.length / 1024).toFixed(0)}KB  ${work.title}`);
    }
    return { assets, declared, credits };
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
        const cueWords = slice.map((word, at) => {
            const fromCharacter = cursor;
            cursor += word.text.length + 1;
            return {
                text: word.text,
                fromCharacter,
                toCharacter: fromCharacter + word.text.length,
                // THE CUE HAS TO DESCRIBE THE AUDIO THAT WAS CUT, not the
                // recording it came from. The last word of the last section
                // absorbs everything to the end of the file, and that tail
                // is trimmed out of the audio above; a cue still claiming
                // the untrimmed length says the voice is speaking through
                // fifteen seconds that are not in the clip.
                durationMs: at === slice.length - 1
                    ? Math.max(1, endMs - (startedAtMs[from + at] ?? startMs))
                    : word.durationMs
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

/**
 * A SEAM BETWEEN WORKS IS NOT A SEAM INSIDE A SENTENCE.
 *
 * `createSourceBreak` puts three words of silence between every pair of
 * sources — `(60000/wpm)*3`, 1125ms at the default — and it is right to:
 * crossing from one book to another should be felt. But these sources are
 * one continuous narration cut into sections so the clock can re-sync, and
 * the reader never left the sentence. Fifteen boundaries added 16.9
 * seconds of dead air that the recording does not contain, each one a
 * black frame with no text, no source and therefore no visual either.
 *
 * The compiler says how to say otherwise: an authored boundary REPLACES
 * the generic break. It also carries a synthetic sourceId —
 * `journey-boundary:<id>` — which is what lets the visual keep rendering
 * across the seam instead of falling to the still fallback.
 *
 * 200ms is the floor the program allows, and a beat between sentences is
 * what the recording has anyway.
 */
const BOUNDARY_MS = 200;
const boundaryId = index => `t${index + 1}`;
// A transition names a source of its own: the validator refuses one that a
// movement already owns, and it carries no text for anything to load.
const boundarySource = index => `seam-${String(index + 1).padStart(2, '0')}`;

function buildProgram(sections) {
    const movements = sections.map((section, index) => ({
        id: `m${index + 1}`,
        anchor: { sourceIds: [section.id] },
        data: { index, title: section.title }
    }));
    const transitions = sections.slice(0, -1).map((section, index) => ({
        id: boundaryId(index),
        anchor: {
            sourceIds: [boundarySource(index)],
            afterSourceId: section.id,
            beforeSourceId: sections[index + 1].id
        },
        data: { fromMovementId: `m${index + 1}`, toMovementId: `m${index + 2}` },
        durationMs: BOUNDARY_MS
    }));
    // The outgoing picture holds through the seam, so nothing goes dark
    // while the reading crosses.
    const visuals = sections.map((section, index) => ({
        id: `v${index + 1}`,
        anchor: {
            sourceIds: index < sections.length - 1
                ? [section.id, boundarySource(index)]
                : [section.id]
        },
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
            { id: 'seams', kind: 'transition', clips: transitions },
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
 *
 * NO LONGER THE MECHANISM. The compiler now retimes atoms directly from a
 * spoken cue's word timings, so a section that carries one lands exact
 * whatever pace it was given, and pass 1 reports 0.0%. What is left here
 * is the fallback for a section the retimer declines — its atom word
 * counts have to sum to its cue's, and a section that does not add up is
 * left entirely alone — and, because it measures the compiled result
 * against the recording, a printed proof that the retimer covered
 * everything. Deleting it would cost both.
 */
async function calibrate(sections, program, sources, declared, passes = 3) {
    const { compileSession } = await import('../src/core/session-compiler.js');
    for (let pass = 0; pass < passes; pass++) {
        const compiled = compileSession({
            wpm: 160, chunkMode: 'phrase', curve: 'flat',
            experienceProgram: program, sources,
            sequenceVisualAssets: declared
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

    // Before anything compiles or renders: a compile validates every
    // `sequence-asset:` cue against what the reading declares it carries,
    // and an unreachable plate should fail here rather than after the audio
    // is cut and Chromium is up.
    const astronomy = await admitAstronomy();

    const voiceBytes = {};
    for (const section of sections) {
        const wav = join(args.out, `${section.id}.wav`);
        voiceBytes[`${section.id}-voice`] = cutAudio(args.audio, section.startMs, section.endMs, wav);
    }

    let program = buildProgram(sections);
    const sources = sections.map(section => ({
        id: section.id, name: section.title, data: section.text
    }));
    program = await calibrate(sections, program, sources, astronomy.declared);

    // HAND OVER WHAT THE VALIDATOR PRODUCES, NOT WHAT I WROTE. The job
    // hashes the program it admits and preflight re-hashes the program it
    // is given; any field the validator rewrites on the way through makes
    // those two disagree and the render is refused. A procedural `config`
    // that normalises to empty is dropped, and an apparitio cue with no
    // palette gains `auto` - so the program that gets hashed has to be the
    // normalised one, rather than one I kept in step by hand.
    program = validateExperienceProgram(program);
    for (const section of sections) {
        console.log(`  ${section.id} paced at ${section.wpm}wpm`);
    }

    writeFileSync(join(args.out, 'program.json'), `${JSON.stringify(program, null, 2)}\n`);

    const { renderArtifact } = await import('../src/core/render/artifact.js');
    const { buildKernelRequest } = await import('../src/core/render/kernel-request.js');
    const request = buildKernelRequest({
        program,
        sources,
        sessionInput: { chunkMode: 'phrase', sequenceVisualAssets: astronomy.declared },
        // WITHOUT THIS THE CHAMBER'S FROSTED TILE COMES ALONG. Omitting
        // `caption` asks for Chamber-identical paint, where glass follows
        // the visual — and the Chamber tile is a `backdrop-filter` pane
        // sized to the words. Over full-bleed imagery it reads as frosted
        // glass; over these mostly-black procedural fields it has nothing
        // to frost and reads as a hard grey rectangle parked behind every
        // line. Caption mode draws the words as a burn-in and leaves the
        // field alone.
        //
        // Centre, not the movie-standard bottom, because that is where
        // this piece already puts its words; the box is the defect, not
        // the composition. A soft shadow carries legibility instead, and
        // no stroke, which a serif at this size cannot wear.
        caption: {
            fontFamily: '"Crimson Pro", Georgia, serif',
            fontSize: 46,
            fontWeight: 400,
            edgeColor: 'none',
            shadow: true,
            position: 'center',
            // Caption mode draws no pane unless the caption asks for one.
            // Now that the fields behind are photographs and lit Turrell
            // rather than near-black, the tile has something to frost.
            glass: true
        },
        // The social profiles cap a job at 90 seconds, which is a social
        // post rather than a piece. Cinema allows ten minutes at 1080p,
        // which is what a narration of this length needs.
        profileId: 'cinema-landscape-1080',
        // A PLATE HAS TO MOVE MORE THAN THE 8-BIT FLOOR. The default 0.06
        // drift is about a twentieth of a pixel per frame over a run this
        // long: measured across the whole background of a section, the
        // largest frame-to-frame difference it produced was ONE least
        // significant bit, so the picture sat dead still and the only
        // motion in the frame was the caption changing line.
        motion: { drift: 0.18 },
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
        assets: astronomy.assets,
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

    // THE VIDEO CANNOT BE POSTED WITHOUT THIS. CC BY 4.0 s3(a) is satisfied
    // by the credit travelling with the work in a manner reasonable to the
    // medium, and an MP4 has no Curia for a reader to reach, so the post
    // that carries the file is what carries the credit.
    const creditPath = join(args.out, 'CREDIT.txt');
    const block = ['Imagery', ...astronomy.credits.map(line => `  ${line}`), ''].join('\n');
    writeFileSync(creditPath, block);
    console.log('');
    console.log('[video] paste into the post — the file cannot be published without it:');
    console.log('');
    console.log(block);
    console.log(`[video] also at ${creditPath}`);
}

main().catch(error => {
    console.error(`[video] ${error?.code || ''} ${error?.message || error}`);
    if (error?.details) console.error(JSON.stringify(error.details, null, 2).slice(0, 800));
    process.exitCode = 1;
});
