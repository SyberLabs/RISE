/**
 * The Chapel Rosary shareable door.
 *
 * A stranger is handed `#rosary`. The hash is the door. The router
 * does not own it; nothing here writes location.hash.
 */

export const ROSARY_DOOR_HASH = '#rosary';

export function isRosaryDoor() {
  return (globalThis.location?.hash || '') === ROSARY_DOOR_HASH;
}

/** The URL a complete-screen copy must write. Same door, no set, no clip. */
export function rosaryDoorHref() {
  const origin = globalThis.location?.origin || '';
  const pathname = globalThis.location?.pathname || '/';
  return `${origin}${pathname}${ROSARY_DOOR_HASH}`;
}
