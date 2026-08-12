import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonalSwells } from './personal-swells.js';
import { SourceCache } from '../sources/cache.js';
import { WorkshopMedia } from './workshop-media.js';
import {
    clearUserData,
    exportUserData,
    USER_DATA_EXPORT_LIMITS,
    USER_DATA_KEYS
} from './user-data.js';
import { VISUAL_CONSENT_KEY } from './visual-safety.js';

describe('personal data inventory', () => {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('exports every declared local store and omits source caches', async () => {
        localStorage.setItem(USER_DATA_KEYS.settings, JSON.stringify({ fontSize: 'large' }));
        localStorage.setItem(USER_DATA_KEYS.journals, JSON.stringify([{ id: 'entry' }]));
        vi.spyOn(PersonalSwells, 'getAll').mockResolvedValue([]);
        vi.spyOn(WorkshopMedia, 'init').mockResolvedValue(undefined);
        vi.spyOn(WorkshopMedia, 'getAllRecords').mockResolvedValue([]);

        const data = await exportUserData();

        expect(data.stores.settings).toEqual({ fontSize: 'large' });
        expect(data.stores.journals).toEqual([{ id: 'entry' }]);
        expect(data.workshopMedia).toEqual([]);
        expect(data).not.toHaveProperty('sourceCache');
        expect(data.exportSummary).toEqual({
            inlineBinaryBytes: 0,
            maxInlineBinaryBytes: USER_DATA_EXPORT_LIMITS.maxInlineBinaryBytes,
            withheldMedia: 0
        });
    });

    it('lists a video without inlining it, and says so', async () => {
        // Every record here is base64'd into one JSON string. An MP4 may be
        // 96 MB, so a single asset would build a document larger than this
        // export was ever sized for — the failure Phase 0.4 finding #3 found
        // at 8 MB, met again at twelve times the ceiling.
        vi.spyOn(PersonalSwells, 'getAll').mockResolvedValue([]);
        vi.spyOn(WorkshopMedia, 'init').mockResolvedValue(undefined);
        vi.spyOn(WorkshopMedia, 'getAllRecords').mockResolvedValue([
            {
                id: 'reel', projectId: 'p1', mimeType: 'video/mp4',
                byteLength: 96_000_000, createdAt: 1, updatedAt: 2,
                data: new Blob(['x'], { type: 'video/mp4' })
            },
            {
                id: 'plate', projectId: 'p1', mimeType: 'image/png',
                byteLength: 2_048, createdAt: 1, updatedAt: 2,
                data: new Blob(['y'], { type: 'image/png' })
            }
        ]);

        const data = await exportUserData();
        const [video, image] = data.workshopMedia;

        expect(video.id).toBe('reel');
        expect(video.data).toBeNull();
        expect(video.withheld).toBe('video');
        // The inventory still travels, so the file says what it is not carrying.
        expect(video.byteLength).toBe(96_000_000);
        expect(video.mimeType).toBe('video/mp4');

        expect(image.data).toMatch(/^data:image\/png/);
        expect(image).not.toHaveProperty('withheld');

        expect(data.warnings.join(' ')).toMatch(/1 video file .* not included/);
        expect(data.warnings.join(' ')).toMatch(/reel/);
        expect(data.exportSummary.withheldMedia).toBe(1);
    });

    it('bounds all inlined binary across personal audio and project images', async () => {
        vi.spyOn(PersonalSwells, 'getAll').mockResolvedValue([{
            id: 'voice', name: 'Voice', timestamp: 1, type: 'audio/wav',
            data: new Blob(['abc'], { type: 'audio/wav' })
        }]);
        vi.spyOn(WorkshopMedia, 'init').mockResolvedValue(undefined);
        vi.spyOn(WorkshopMedia, 'getAllRecords').mockResolvedValue([{
            id: 'plate', projectId: 'p1', mimeType: 'image/png',
            byteLength: 2, createdAt: 1, updatedAt: 2,
            data: new Blob(['de'], { type: 'image/png' })
        }]);

        const data = await exportUserData(null, { maxInlineBinaryBytes: 4 });

        expect(data.personalSwells[0].data).toMatch(/^data:audio\/wav/);
        expect(data.workshopMedia[0]).toMatchObject({
            id: 'plate', data: null, withheld: 'budget', byteLength: 2
        });
        expect(data.exportSummary).toEqual({
            inlineBinaryBytes: 3,
            maxInlineBinaryBytes: 4,
            withheldMedia: 1
        });
        expect(data.warnings.join(' ')).toMatch(/reached its .* binary budget/);
    });

    it('clears local stores, visual consent, personal audio, workshop media, and source caches', async () => {
        Object.values(USER_DATA_KEYS).forEach(key => localStorage.setItem(key, '{}'));
        sessionStorage.setItem(VISUAL_CONSENT_KEY, 'true');
        const clearSwells = vi.spyOn(PersonalSwells, 'clear').mockResolvedValue(undefined);
        const clearCache = vi.spyOn(SourceCache, 'clear').mockResolvedValue(undefined);
        const clearMedia = vi.spyOn(WorkshopMedia, 'clear').mockResolvedValue(undefined);

        await clearUserData();

        Object.values(USER_DATA_KEYS).forEach(key => expect(localStorage.getItem(key)).toBeNull());
        expect(sessionStorage.getItem(VISUAL_CONSENT_KEY)).toBeNull();
        expect(clearSwells).toHaveBeenCalledOnce();
        expect(clearCache).toHaveBeenCalledOnce();
        expect(clearMedia).toHaveBeenCalledOnce();
    });
});
