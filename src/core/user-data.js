import { PersonalSwells } from './personal-swells.js';
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
        data.warnings = [`Personal audio could not be exported: ${error.message || 'storage unavailable'}`];
    }

    try {
        await WorkshopMedia.init();
        const records = await WorkshopMedia.getAllRecords();
        data.workshopMedia = await Promise.all(records.map(async record => ({
            id: record.id,
            projectId: record.projectId,
            mimeType: record.mimeType,
            byteLength: record.byteLength,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            data: await blobToDataUrl(record.data)
        })));
    } catch (error) {
        const warning = `Workshop media could not be exported: ${error.message || 'storage unavailable'}`;
        data.warnings = Array.isArray(data.warnings) ? [...data.warnings, warning] : [warning];
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
