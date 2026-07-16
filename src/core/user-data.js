import { PersonalSwells } from './personal-swells.js';
import { SourceCache } from '../sources/cache.js';
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

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read uploaded audio'));
        reader.readAsDataURL(blob);
    });
}

export async function exportUserData(settings = null) {
    const data = {
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        stores: {},
        personalSwells: []
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

    return data;
}

export async function clearUserData() {
    for (const key of Object.values(USER_DATA_KEYS)) localStorage.removeItem(key);
    endVisualInterlocutionSession();

    const results = await Promise.allSettled([
        PersonalSwells.clear(),
        SourceCache.clear()
    ]);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
        throw new AggregateError(failures.map(result => result.reason), 'Some browser data could not be cleared');
    }
}
