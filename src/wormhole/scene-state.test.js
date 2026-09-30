import { describe, expect, it } from 'vitest';
import { RING_RADIUS, arc, initialScene, shipPose, stepScene, wrapAngle } from './scene-state.js';

const run = (scene, seconds, flags) => {
  for (let i = 0; i < seconds * 60; i += 1) stepScene(scene, 1 / 60, flags);
  return scene;
};

describe('the crossing', () => {
  it('accelerates toward full thrust without overshooting, and settles back more slowly', () => {
    const scene = initialScene();
    const rising = [];
    for (let i = 0; i < 90; i += 1) { stepScene(scene, 1 / 60, { jumping: true }); rising.push(scene.thrust); }
    expect(rising.every((v, i) => i === 0 || v >= rising[i - 1])).toBe(true);
    expect(Math.max(...rising)).toBeLessThanOrEqual(1);
    expect(scene.thrust).toBeGreaterThan(0.95);
    // Settling: after the same time, the way down is not yet as far as the way up.
    const falling = initialScene();
    falling.thrust = 1;
    run(falling, 0.5, { jumping: false });
    const climbing = initialScene();
    run(climbing, 0.5, { jumping: true });
    expect(1 - falling.thrust).toBeLessThan(climbing.thrust);
  });

  it('flows faster under thrust, and always forward', () => {
    const calm = run(initialScene(), 2, {});
    const rush = run(initialScene(), 2, { jumping: true });
    expect(rush.flow).toBeGreaterThan(calm.flow * 5);
    expect(calm.flow).toBeGreaterThan(0);
  });

  it('opens the gate on arrival and closes it again for the next crossing', () => {
    const scene = run(initialScene(), 4, { arrived: true });
    expect(scene.open).toBeGreaterThan(0.95);
    run(scene, 4, { arrived: false });
    expect(scene.open).toBeLessThan(0.05);
  });

  it('is a function of what it is given: the same frames make the same scene', () => {
    expect(run(initialScene(), 1.5, { jumping: true, aim: 1 })).toEqual(run(initialScene(), 1.5, { jumping: true, aim: 1 }));
  });

  it('caps a long frame, so a hidden tab coming back does not lurch', () => {
    const scene = initialScene();
    stepScene(scene, 30, { jumping: true });
    expect(scene.time).toBeCloseTo(0.05, 5);
  });
});

describe('under reduced motion', () => {
  it('snaps to the state it should show, and time stands still', () => {
    const scene = initialScene();
    const rest = scene.angle;
    stepScene(scene, 1, { jumping: true, arrived: true, reduced: true, aim: 2 });
    expect(scene).toEqual({ time: 0, flow: 0, thrust: 1, open: 1, angle: rest, turn: 0 });
    stepScene(scene, 1, { jumping: false, arrived: false, reduced: true });
    expect(scene).toEqual({ time: 0, flow: 0, thrust: 0, open: 0, angle: rest, turn: 0 });
  });
});

describe('angles', () => {
  it('wrap into (-π, π], and take the shorter way round', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(0.5 + 2 * Math.PI)).toBeCloseTo(0.5, 9);
    expect(arc(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
    expect(arc(-3, 3)).toBeCloseTo(6 - 2 * Math.PI, 9);
    expect(Math.abs(arc(0.1, 6.2))).toBeLessThan(0.3);
  });
});

/** Every frame's change of angle, along the shorter arc, so a wrap is not mistaken for a jump. */
function stepsOf(scene, frames, flagsAt) {
  const steps = [];
  for (let i = 0; i < frames; i += 1) {
    const before = scene.angle;
    stepScene(scene, 1 / 60, flagsAt(i));
    steps.push(arc(before, scene.angle));
  }
  return steps;
}

describe('the ship riding its ring', () => {
  const MOST_PER_FRAME = 4.2 / 60 + 1e-9;

  it('waits at the bottom of the ring until the reader points, and stays where it is when they stop', () => {
    const scene = run(initialScene(), 2, {});
    expect(scene.angle).toBeCloseTo(-Math.PI / 2, 9);
    run(scene, 2, { aim: 0 });
    const reached = scene.angle;
    run(scene, 2, {});
    expect(scene.angle).toBeCloseTo(reached, 3);
    expect(Math.abs(scene.turn)).toBeLessThan(1e-3);
  });

  it('closes on the bearing it is given, and settles there', () => {
    const scene = run(initialScene(), 3, { aim: 2.2 });
    expect(arc(scene.angle, 2.2)).toBeCloseTo(0, 2);
    expect(Math.abs(scene.turn)).toBeLessThan(0.01);
  });

  it('never moves faster than its top speed, so it never jumps', () => {
    const scene = initialScene();
    const steps = stepsOf(scene, 240, i => ({ aim: i < 120 ? 2.9 : -2.9 }));
    expect(Math.max(...steps.map(Math.abs))).toBeLessThanOrEqual(MOST_PER_FRAME);
  });

  it('goes the short way across the point where the angle wraps', () => {
    const scene = initialScene();
    scene.angle = 3;
    const steps = stepsOf(scene, 200, () => ({ aim: -3 }));
    // From 3 to -3 is a sixth of a turn one way, not five sixths the other.
    const travelled = steps.reduce((sum, step) => sum + Math.abs(step), 0);
    expect(travelled).toBeLessThan(0.6);
    expect(arc(scene.angle, -3)).toBeCloseTo(0, 2);
  });

  it('stays continuous when the pointer sweeps past the point straight opposite, where the short way flips', () => {
    const scene = initialScene();
    scene.angle = 0;
    // The aim starts a hair short of the far side, then sweeps across it and on round.
    const steps = stepsOf(scene, 600, i => ({ aim: Math.PI - 0.4 + (i / 600) * 0.8 }));
    expect(Math.max(...steps.map(Math.abs))).toBeLessThanOrEqual(MOST_PER_FRAME);
    // And the speed itself changes smoothly, not from full one way to full the other in a frame.
    const speeds = steps.map(step => step * 60);
    const worstChange = Math.max(...speeds.slice(1).map((v, i) => Math.abs(v - speeds[i])));
    expect(worstChange).toBeLessThan(1.2);
  });

  it('follows a pointer circling it, without ever leaving the ring or jumping', () => {
    const scene = initialScene();
    const steps = stepsOf(scene, 900, i => ({ aim: (i / 900) * Math.PI * 4 }));
    expect(Math.max(...steps.map(Math.abs))).toBeLessThanOrEqual(MOST_PER_FRAME);
    for (const value of [scene.angle, scene.turn]) expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(scene.angle)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('the ship\'s pose', () => {
  const at = angle => ({ ...initialScene(), angle });

  it('is always on its ring, whatever the bearing', () => {
    const rest = shipPose(at(0));
    const gateY = rest.y;   // at angle 0 the ship is level with the gate, one radius to its right
    for (let k = 0; k < 24; k += 1) {
      const angle = (k / 24) * 2 * Math.PI - Math.PI;
      const pose = shipPose(at(angle));
      // Measured from the gate's own height, the ship is one ring's radius away, at every angle.
      expect(Math.hypot(pose.x, pose.y - gateY)).toBeCloseTo(RING_RADIUS, 1);
      expect(pose.z).toBe(rest.z);
    }
  });

  it('rests at the bottom of the ring, below the gate and in front of the camera, with a short flame', () => {
    const pose = shipPose(initialScene());
    const level = shipPose(at(0));
    expect(pose.y).toBeLessThan(level.y);
    expect(pose.x).toBeCloseTo(0, 5);
    expect(pose.z).toBeLessThan(-3);
    expect(pose.flame).toBeLessThan(0.6);
  });

  it('turns its top toward the gate wherever it is: upright at the bottom, on its side at the edges, inverted at the top', () => {
    const bank = angle => shipPose(at(angle)).bank - angle;
    // Its roll is the angle plus a quarter turn, give or take a little sway.
    for (const angle of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      expect(bank(angle)).toBeCloseTo(Math.PI / 2, 0);
    }
    expect(Math.abs(wrapAngle(shipPose(at(-Math.PI / 2)).bank))).toBeLessThan(0.1);
    expect(Math.abs(Math.abs(wrapAngle(shipPose(at(Math.PI / 2)).bank)) - Math.PI)).toBeLessThan(0.1);
  });

  it('draws away and lengthens its flame in the rush, and holds nearer the gate once it opens', () => {
    const rest = shipPose(initialScene());
    const rush = shipPose({ ...initialScene(), time: 1, thrust: 1 });
    const held = shipPose({ ...initialScene(), time: 1, open: 1 });
    expect(rush.z).toBeLessThan(rest.z - 1.5);
    expect(rush.flame).toBeGreaterThan(rest.flame + 0.8);
    expect(held.z).toBeLessThan(rest.z);
    expect(held.z).toBeGreaterThan(rush.z);
  });
});
