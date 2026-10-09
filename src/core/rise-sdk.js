/**
 * The RiseSDK: the renderer contract's values in one module, for whoever
 * builds against RISE from outside it (docs/specs/RISE-SDK.md).
 *
 * Data only. Every value here is re-exported from the module that decides it,
 * so the contract and the runtime cannot hold two different numbers; the
 * document quotes these and src/core/rise-sdk.test.js holds the two equal.
 * It reaches only the core and the scenes, never a host or a room.
 *
 * RISE_SDK_VERSION is provisional until the owner's Live Run: until then any
 * of this may change, with the document, in the same change. After it, a 1.x
 * change only adds; anything else is a new major version.
 */
export const RISE_SDK_VERSION = '1.0.0-provisional';

export {
  RISE_CURRENT_SCHEMA, RISE_CURRENT_SCHEMA_V2, RISE_CURRENT_LIMITS, RISE_CURRENT_STYLES, RISE_CURRENT_LOOKS,
  RISE_CURRENT_THEME_IDS, RISE_CURRENT_VISUALS
} from './rise-current.js';
export { BEAT_LIMITS, BEAT_PLACES, BEAT_SIZES, BEAT_TYPES, BEAT_CUE_PATTERN } from './beats.js';
export { STYLES } from './styles.js';
export { TYPE_FACES, TYPE_ROLES } from './typography.js';
export { SCENE_MANIFESTS, SCENE_ENGINES } from '../scenes/manifests.js';
export { SCENE_PROTOCOL_VERSION, TO_WORKER, TO_HOST, SCENE_LIMITS } from '../scenes/scene-protocol.js';
export { BANNED_SCENE_NAMES, SHADOWED_GLOBALS, STATIC_ONLY_NAMES } from '../scenes/scene-bans.js';
export { LIBRARY_DEFAULTS } from '../scenes/scene-library.js';
export { SVG_ELEMENTS } from './svg-admission.js';
