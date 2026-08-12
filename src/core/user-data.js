import { PersonalSwells } from './personal-swells.js';
import { READING_LIMITS } from './reading-limits.js';
import { SourceCache } from '../sources/cache.js';
import { WorkshopMedia, blobToDataUrl } from './workshop-media.js';
import { endVisualInterlocutionSession } from './visual-safety.js';

export const USER_DATA_KEYS = Object.freeze({
    settings: 'rise-settings',
    journals: 'rise_recursions_v1',
    blueprints: 'rise_workshop_v1',
    globalImages: 'rise_global_images_v1',
    solPlan: 'rise_sol_plan_v1',
    orbitalPreferences: 'rise_orbital_prefs_v1',
    orbitalText: 'rise_orbital_text_v1'
});

function addWarning(data, warning) {
    data.warnings = Array.isArray(data.warnings) ? [...data.warnings, warning] : [warning];
}

function parseStoredValue(raw) {
    if (raw === null) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

export async function exportUserData(settings = null) {
    const data = {
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
        stores: {},
        personalSwells: [],
        workshopMedia: []
    };

    for (const [label, key] of Object.entries(USER_DATA_KEYS)) {
        const value = parseStoredValue(localStorage.getItem(key));
        if (value !== null) data.stores[label] = value;
    }
    if (settings && !data.stores.settings) data.stores.settings = settings;

    try {
        const swells = await PersonalSwells.getAll();
        data.personalSwells = await Promise.all(swells.map(async swell => ({
            id: swell.id,
            name: swell.name,
            timestamp: swell.timestamp,
            type: swell.type,
            data: await blobToDataUrl(swell.data)
        })));
    } catch (error) {
        addWarning(data, `Personal audio could not be exported: ${error.message || 'storage unavailable'}`);
    }

    try {
        await WorkshopMedia.init();
        const records = await WorkshopMedia.getAllRecords();
        const withheld = [];
        data.workshopMedia = await Promise.all(records.map(async record => {
            const entry = {
                id: record.id,
                projectId: record.projectId,
                mimeType: record.mimeType,
                byteLength: record.byteLength,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt
            };
            // VIDEO IS INVENTORIED, NEVER INLINED. Everything here is base64'd
            // into a single JSON string, which inflates it by a third, and one
            // MP4 may be maxVideoFileBytes — so a single asset would build a
            // document larger than this export was ever sized for. The record's
            // identity and size still travel, so the file says what it is not
            // carrying instead of omitting it silently.
            if (record.mimeType === 'video/mp4') {
                withheld.push(record.id);
                return { ...entry, data: null, withheld: 'video' };
            }
            return { ...entry, data: await blobToDataUrl(record.data) };
        }));
        if (withheld.length) {
            addWarning(data,
                `${withheld.length} video file${withheld.length === 1 ? '' : 's'} `
                + `(up to ${Math.round(READING_LIMITS.maxVideoFileBytes / 1024 / 1024)} MB each) `
                + 'are listed but not included: video is too large to carry inside a JSON export. '
                + `Ids: ${withheld.join(', ')}`);
        }
    } catch (error) {
        addWarning(data, `Workshop media could not be exported: ${error.message || 'storage unavailable'}`);
    }

    return data;
}

export async function clearUserData() {
    for (const key of Object.values(USER_DATA_KEYS)) localStorage.removeItem(key);
    endVisualInterlocutionSession();

    const results = await Promise.allSettled([
        PersonalSwells.clear(),
        SourceCache.clear(),
        WorkshopMedia.clear()
    ]);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
        throw new AggregateError(failures.map(result => result.reason), 'Some browser data could not be cleared');
    }
}
