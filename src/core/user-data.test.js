import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonalSwells } from './personal-swells.js';
import { SourceCache } from '../sources/cache.js';
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

        const data = await exportUserData();

        expect(data.stores.settings).toEqual({ fontSize: 'large' });
        expect(data.stores.journals).toEqual([{ id: 'entry' }]);
        expect(data).not.toHaveProperty('sourceCache');
    });

    it('clears local stores, visual consent, personal audio, and source caches', async () => {
        Object.values(USER_DATA_KEYS).forEach(key => localStorage.setItem(key, '{}'));
        sessionStorage.setItem(VISUAL_CONSENT_KEY, 'true');
        const clearSwells = vi.spyOn(PersonalSwells, 'clear').mockResolvedValue(undefined);
        const clearCache = vi.spyOn(SourceCache, 'clear').mockResolvedValue(undefined);

        await clearUserData();

        Object.values(USER_DATA_KEYS).forEach(key => expect(localStorage.getItem(key)).toBeNull());
        expect(sessionStorage.getItem(VISUAL_CONSENT_KEY)).toBeNull();
        expect(clearSwells).toHaveBeenCalledOnce();
        expect(clearCache).toHaveBeenCalledOnce();
    });
});
