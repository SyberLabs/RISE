import { describe, expect, it } from 'vitest';
import { initialScene, shipPose, stepScene } from './scene-state.js';

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
    expect(run(initialScene(), 1.5, { jumping: true })).toEqual(run(initialScene(), 1.5, { jumping: true }));
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
    stepScene(scene, 1, { jumping: true, arrived: true, reduced: true });
    expect(scene).toEqual({ time: 0, flow: 0, thrust: 1, open: 1 });
    stepScene(scene, 1, { jumping: false, arrived: false, reduced: true });
    expect(scene).toEqual({ time: 0, flow: 0, thrust: 0, open: 0 });
  });
});

describe('the ship\'s pose', () => {
  it('rests below the axis and in front of the camera, with a short flame', () => {
    const pose = shipPose(initialScene());
    expect(pose.y).toBeLessThan(0);
    expect(pose.z).toBeLessThan(-3);
    expect(pose.flame).toBeLessThan(0.6);
  });

  it('draws away and lengthens its flame in the rush, and holds nearer the gate once it opens', () => {
    const rest = shipPose(initialScene());
    const rush = shipPose({ time: 1, flow: 0, thrust: 1, open: 0 });
    const held = shipPose({ time: 1, flow: 0, thrust: 0, open: 1 });
    expect(rush.z).toBeLessThan(rest.z - 1.5);
    expect(rush.flame).toBeGreaterThan(rest.flame + 0.8);
    expect(held.z).toBeLessThan(rest.z);
    expect(held.z).toBeGreaterThan(rush.z);
  });

  it('leans away from where the reader looks', () => {
    const left = shipPose(initialScene(), [-1, 0]);
    const right = shipPose(initialScene(), [1, 0]);
    expect(left.bank).toBeGreaterThan(right.bank);
  });
});
