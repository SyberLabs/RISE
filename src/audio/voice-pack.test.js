import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import heartBeta from '../../scripts/voice-packs/heart-beta.mjs';
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
        expect(entry.onsetsMs.at(-1)).toBeGreaterThan(2400);
    });
});
