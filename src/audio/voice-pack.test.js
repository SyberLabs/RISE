import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import heartBeta from '../../scripts/voice-packs/heart-beta.mjs';
import { splitWords } from '../core/recitation.js';
import {
    availableVoicePacks,
    resolveVoicePackEntry,
    speakableText,
    voicePackManifest
} from './voice-pack.js';

describe('shipped Recitation pack', () => {
    it('admits Heart and no unbuilt voices', () => {
        expect(availableVoicePacks()).toEqual([{
            id: 'af_heart',
            label: 'Heart — warm, the reference voice',
            entryCount: 877
        }]);
    });

    it('covers every speakable atom in the Heart beta session', () => {
        const atoms = heartBeta.sessions[0].atoms;
        const speakable = atoms.filter(atom => speakableText(atom));
        expect(speakable.length).toBeGreaterThan(90);

        for (const atom of speakable) {
            expect(
                resolveVoicePackEntry(
                    'af_heart',
                    atom,
                    voicePackManifest
                ),
                `missing static speech for "${speakableText(atom)}"`
            ).not.toBeNull();
        }
    });

    it('ships every manifest asset as a nonempty WAV', () => {
        const entries = voicePackManifest.voices.af_heart.entries;
        for (const entry of Object.values(entries)) {
            const path = resolve(
                process.cwd(),
                'public',
                entry.asset.replace(/^\/+/, '')
            );
            expect(existsSync(path), `${entry.asset} is missing`).toBe(true);
            expect(statSync(path).size, `${entry.asset} is empty`)
                .toBeGreaterThan(44);
        }
    });

    it('preserves the Tintern pronunciation repair', () => {
        const entry = resolveVoicePackEntry(
            'af_heart',
            'Of five long winters! and again I hear',
            voicePackManifest
        );

        expect(entry).toMatchObject({
            text: 'Of five long winters! and again I hear',
            spokenText: 'Of five long winters! And again, I hear.'
        });
        // THE REPAIR IS AUDIBLE, AND THE ALIGNMENT SHOWS IT.
        //
        // This used to assert that the last onset fell past 2400ms, which
        // held only because the energy detector bunched its boundaries
        // toward the end of a clip — an artefact of looking for silences,
        // not a fact about the recording. Aligned, the line reads
        // Of@342 five@462 long@764 winters!@1005 And@1769 ... hear.@2351.
        //
        // What the repair actually buys is the full stop after "winters":
        // the voice takes a breath there instead of running the line on.
        // That pause is the thing worth holding, so hold it directly.
        const words = splitWords(entry.spokenText).map(word => word.text);
        expect(entry.onsetsMs).toHaveLength(words.length);
        const after = word => entry.onsetsMs[words.indexOf(word) + 1]
            - entry.onsetsMs[words.indexOf(word)];
        const gaps = words.slice(0, -1).map(word => after(word));
        const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
        expect(after('winters!'), 'the sentence break is a real pause')
            .toBeGreaterThan(median * 2);
        expect(entry.onsetsMs.at(-1)).toBeLessThan(entry.durationMs);
    });
});
