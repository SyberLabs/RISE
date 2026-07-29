/**
 * First static Recitation admission set.
 *
 * This is the exact phrase-mode full "Meditations" selection already shipped
 * by the Library. Keeping the plan executable means the atoms come from the
 * same compiler as the Chamber; there is no hand-maintained segmentation that
 * can drift from playback.
 */
import { compileSession } from '../../src/core/session-compiler.js';
import { LITERARY_DEEP } from '../../src/sources/text/data/literary_deep.js';

const source = LITERARY_DEEP.meditations;
const text = source.sequences
    .map(sequence => sequence.content)
    .join('\n\n');

const session = compileSession({
    name: source.title,
    text,
    source: 'Meditations',
    chunkMode: 'phrase',
    wpm: 190,
    curve: 'flat',
    recitation: { enabled: true },
    voiceId: 'af_heart'
});

export default {
    voiceId: 'af_heart',
    label: 'Heart — warm, the reference voice',
    sessions: [session]
};
