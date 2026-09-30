/**
 * What the scene is doing, as numbers: how fast the throat is rushing past, how
 * far the gate has opened, where the ship is on its ring. Everything eases toward
 * a target instead of snapping, so the crossing has weight. Pure, so a test can
 * hold it.
 */

const DRIFT = 0.06;       // the throat's idle flow, while the reader decides
const RUSH = 3.4;         // added flow at full thrust
const THRUST_IN = 3.2;    // per second: the crossing accelerates quickly...
const THRUST_OUT = 1.4;   // ...and settles slowly
const OPEN_RATE = 1.3;

const TAU = Math.PI * 2;
const REST_ANGLE = -Math.PI / 2;   // the bottom of the ring, where the ship waits
const MAX_TURN = 4.2;              // rad/s: the fastest the ship travels round its ring
const FOLLOW = 6.5;                // per second: how eagerly it closes on the bearing
const INERTIA = 10;                // per second: how quickly its speed follows its wish

// The ring, in the units the ship is built in (see ship.js), at the ship's resting depth. There is
// less room above the gate than below it, so the ring is tight and the ship is drawn a little
// under life size: its whole hull stays in the picture at every bearing.
export const RING_RADIUS = 0.9;
export const SHIP_SCALE = 0.62;
const GATE_HEIGHT = 0.16 * Math.tan((38 * Math.PI) / 360);   // the gate's height, per unit of depth
const REST_DEPTH = 6.3;

export const initialScene = () => ({ time: 0, flow: 0, thrust: 0, open: 0, angle: REST_ANGLE, turn: 0 });

const ease = (from, to, rate, dt) => from + (to - from) * Math.min(1, dt * rate);

/** An angle brought into (-π, π]. */
export function wrapAngle(angle) {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** The signed way round from one angle to another, the shorter way: in (-π, π]. */
export const arc = (from, to) => wrapAngle(to - from);

/**
 * Advance one frame. `jumping` is the crossing, `arrived` a destination held,
 * and `aim` the bearing the reader is pointing at (undefined: hold where it is).
 *
 * The ship never sets its angle from the aim. It has a speed, which it eases
 * toward "close the shorter arc, no faster than MAX_TURN", and the angle follows
 * the speed. So its position is continuous however the aim moves, including when
 * the aim passes the point straight opposite, where the shorter way round flips.
 *
 * Under reduced motion nothing moves: the scene snaps to where it should be and
 * time stands still.
 */
export function stepScene(scene, dt, { jumping = false, arrived = false, reduced = false, aim } = {}) {
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

  const wish = aim === undefined ? 0 : Math.max(-MAX_TURN, Math.min(MAX_TURN, arc(scene.angle, aim) * FOLLOW));
  scene.turn += (wish - scene.turn) * Math.min(1, step * INERTIA);
  scene.angle = wrapAngle(scene.angle + scene.turn * step);
  return scene;
}

/**
 * The pose the ship holds: on its ring, at the bearing it has reached, its top
 * toward the gate and its underside to the wall, like a craft riding the inside
 * of a tube (so at the top of the ring it is upside down).
 */
export function shipPose(scene) {
  const calm = 1 - scene.thrust * 0.6;
  // Away from the camera in the rush, and holding a little nearer the gate once it has opened.
  const z = -REST_DEPTH - scene.thrust * 2.6 - scene.open * 0.8;
  // The gate is a fixed height in the picture, so its height in the ship's units follows the depth.
  const gateY = GATE_HEIGHT * -z;
  const radius = RING_RADIUS + Math.sin(scene.time * 0.7) * 0.05 * calm;
  return {
    x: Math.cos(scene.angle) * radius,
    y: gateY + Math.sin(scene.angle) * radius,
    z,
    scale: SHIP_SCALE,
    // Rolled so its top faces the gate, wherever it is on the ring.
    bank: scene.angle + Math.PI / 2 + Math.sin(scene.time * 0.55) * 0.06 * calm,
    // Nose toward the gate, and up: the top of the hull turns to the camera.
    pitch: 0.34 + Math.sin(scene.time * 0.5) * 0.03 + scene.thrust * 0.05,
    yaw: Math.sin(scene.time * 0.3) * 0.05,
    flame: 0.35 + scene.thrust * 1.15 + Math.sin(scene.time * 23) * 0.06 * (0.4 + scene.thrust)
  };
}
