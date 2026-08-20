/**
 * The Chapel Rosary shareable door.
 *
 * A stranger is handed `#rosary`. The hash is the door. The router
 * does not own it; nothing here writes location.hash.
 */

export const ROSARY_DOOR_HASH = '#rosary';

export function isRosaryDoor(locationLike = globalThis.location) {
  return (locationLike?.hash || '') === ROSARY_DOOR_HASH;
}

/** The URL a complete-screen copy must write. Same door, no set, no clip. */
export function rosaryDoorHref(locationLike = globalThis.location) {
  const origin = locationLike?.origin || '';
  const pathname = locationLike?.pathname || '/';
  return `${origin}${pathname}${ROSARY_DOOR_HASH}`;
}
