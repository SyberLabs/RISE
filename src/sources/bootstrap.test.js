/**
 * The source system used to be built at boot: seven providers constructed
 * before the Portal painted, each dragging its inline data — 22 KB of verse
 * in sacred.js, 32 KB of starters behind local.js, the *_deep catalogues
 * behind archive.js — into the main chunk. Nothing on the Portal path reads
 * any of it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SourceRegistry } from './registry.js';
import { SOURCE_PROVIDER_IDS, ensureSourceSystem, resetSourceSystem } from './bootstrap.js';

describe('the source system', () => {
    beforeEach(() => {
        resetSourceSystem();
        for (const provider of SourceRegistry.getAll()) {
            SourceRegistry.unregister(provider.id);
        }
    });

    it('registers nothing until something asks for it', () => {
        expect(SourceRegistry.getAll()).toEqual([]);
    });

    /**
     * The declared list is the promise; the loaders are the delivery. A
     * provider added to one and not the other is the vocabulary-in-two-places
     * defect PROJECT-KNOWLEDGE 2.1 names, and this is where it fails.
     */
    it('brings up exactly the providers it declares', async () => {
        await ensureSourceSystem();
        const registered = SourceRegistry.getAll().map(provider => provider.id).sort();
        expect(registered).toEqual([...SOURCE_PROVIDER_IDS].sort());
    });

    it('builds one set of providers however many callers ask at once', async () => {
        await Promise.all([ensureSourceSystem(), ensureSourceSystem()]);
        const ids = SourceRegistry.getAll().map(provider => provider.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(SOURCE_PROVIDER_IDS.length);
    });

    it('keeps provider identity across repeated bootstraps', async () => {
        await ensureSourceSystem();
        const first = SourceRegistry.get('library-archive');
        await ensureSourceSystem();
        expect(SourceRegistry.get('library-archive')).toBe(first);
    });
});
