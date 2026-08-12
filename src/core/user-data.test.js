import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonalSwells } from './personal-swells.js';
import { SourceCache } from '../sources/cache.js';
import { WorkshopMedia } from './workshop-media.js';
import { clearUserData, exportUserData, USER_DATA_KEYS } from './user-data.js';
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
