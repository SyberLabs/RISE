/**
 * Every localStorage key RISE writes, named once.
 *
 * THIS REGISTRY IS THE ERASE AND EXPORT INVENTORY. A key that is not here is
 * data `exportUserData` cannot carry out and `clearUserData` cannot clear —
 * so "Clear all personal data" would quietly leave it on the reader's device
 * while telling them it had gone. Seven keys had drifted out of it exactly
 * that way, four of them recording devotional practice, which is the last
 * thing that should outlive an erase.
 *
 * `user-data-keys.test.js` reads src/ and fails when a key is written
 * anywhere and is not named here or excepted below. That is what keeps this
 * list true; a registry nothing enforces is a list of what someone remembered.
 *
 * IT CARRIES NO IMPORTS ON PURPOSE. A room that needs one key must not pull
 * IndexedDB, media and cache modules into its chunk to get it, which is what
 * importing `user-data.js` for this would cost.
 */
export const USER_DATA_KEYS = Object.freeze({
    settings: 'rise-settings',
    journals: 'rise_recursions_v1',
    blueprints: 'rise_workshop_v1',
    workshopMediaLeases: 'rise_workshop_media_leases_v1',
    globalImages: 'rise_global_images_v1',
    // OUTLIVES ITS ROOM. The Solarium is deleted and this key is not:
    // a reader who planned their day there still has one saved, and a
    // key dropped from this registry is data that export cannot carry
    // out and erase cannot clear. It is removed when nobody can still
    // be holding one, which is not the same day the room goes.
    solPlan: 'rise_sol_plan_v1',
    orbitalPreferences: 'rise_orbital_prefs_v1',
    orbitalText: 'rise_orbital_text_v1',
    // The devotional rooms. How someone prays is a record of religious
    // practice, and an erase that leaves it behind is the wrong kind of
    // quiet.
    chapelIcon: 'rise_chapel_icon_v1',
    rosaryMode: 'rise_chapel_rosary_mode_v1',
    rosarySound: 'rise_rosarium_sound_v1',
    rosaryAdvance: 'rise_rosarium_advance_v1',
    viaSound: 'rise_via_sound_v1',
    viaAdvance: 'rise_via_advance_v1',
    stanceNoteSeen: 'rise-stance-note-seen'
});

/**
 * Keys that are deliberately NOT reader data, with the reason each is out.
 *
 * The reason is the point. Anything here is a claim that erasing it would be
 * wrong, not that clearing it was forgotten, and the test prints this text
 * when a key arrives without one.
 */
export const UNREGISTERED_LOCAL_KEYS = Object.freeze({
    'rise-beta-session':
        'Access state, not reader data. RISE moved from closed to open beta, '
        + 'and clearing this would sign a reader out of a door that no longer '
        + 'locks. Removed with the gate itself.'
});

/** Every key an erase is expected to remove. */
export const ERASABLE_LOCAL_KEYS = Object.freeze(Object.values(USER_DATA_KEYS));

/** Ephemeral records written once per open browser context. */
export const ERASABLE_LOCAL_KEY_PREFIXES = Object.freeze([
    'rise_workshop_media_lease_v2:'
]);
