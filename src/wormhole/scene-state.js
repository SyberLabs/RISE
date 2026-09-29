/**
 * What the scene is doing, as numbers: how fast the throat is rushing past, how
 * far the gate has opened, where the ship is. Everything eases toward a target
 * instead of snapping, so the crossing has weight. Pure, so a test can hold it.
 */

const DRIFT = 0.06;       // the throat's idle flow, while the reader decides
const RUSH = 3.4;         // added flow at full thrust
const THRUST_IN = 3.2;    // per second: the crossing accelerates quickly...
const THRUST_OUT = 1.4;   // ...and settles slowly
const OPEN_RATE = 1.3;

export const initialScene = () => ({ time: 0, flow: 0, thrust: 0, open: 0 });

const ease = (from, to, rate, dt) => from + (to - from) * Math.min(1, dt * rate);

/**
 * Advance one frame. `jumping` is the crossing, `arrived` a destination held.
 * Under reduced motion nothing moves: the scene snaps to where it should be
 * and time stands still.
 */
export function stepScene(scene, dt, { jumping = false, arrived = false, reduced = false } = {}) {
  if (reduced) {
    scene.thrust = jumping ? 1 : 0;
    scene.open = arrived ? 1 : 0;
    return scene;
  }
  const step = Math.min(dt, 0.05);
  scene.time += step;
  scene.thrust = ease(scene.thrust, jumping ? 1 : 0, jumping ? THRUST_IN : THRUST_OUT, step);
  scene.open = ease(scene.open, arrived ? 1 : 0, OPEN_RATE, step);
  scene.flow += step * (DRIFT + scene.thrust * RUSH);
  return scene;
}

/** The pose the ship holds, from the scene: sway, bank, and how far it has moved into the throat. */
export function shipPose(scene, look = [0, 0]) {
  const calm = 1 - scene.thrust * 0.6;
  return {
    x: Math.sin(scene.time * 0.4) * 0.1 * calm - look[0] * 0.15,
    y: -0.86 + Math.sin(scene.time * 0.7) * 0.05 * calm + look[1] * 0.08,
    // Away from the camera in the rush, and holding a little nearer the gate once it has opened.
    z: -6.3 - scene.thrust * 2.6 - scene.open * 0.8,
    bank: Math.sin(scene.time * 0.55) * 0.12 * calm - look[0] * 0.25,
    // Nose up, toward the gate: the top of the hull turns to the camera, and the tail stops filling the view.
    pitch: 0.34 + Math.sin(scene.time * 0.5) * 0.03 + scene.thrust * 0.05,
    yaw: Math.sin(scene.time * 0.3) * 0.06,
    flame: 0.35 + scene.thrust * 1.15 + Math.sin(scene.time * 23) * 0.06 * (0.4 + scene.thrust)
  };
}
