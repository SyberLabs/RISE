import { describe, expect, it } from 'vitest';
import { FLAME_BASE_Z, buildShip } from './ship.js';
import { identity, multiply, normalMatrix, perspective, rotationY, rotationZ, scaling, transform, translation } from './gl-math.js';

const { hull, flame } = buildShip();
const triangles = mesh => Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
  [0, 1, 2].map(k => { const at = mesh.indices[i * 3 + k] * 3; return mesh.positions.slice(at, at + 3); }));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

describe('the rocket mesh', () => {
  it('is a real, small mesh: every index in range, three floats a vertex, and faces to spare', () => {
    for (const mesh of [hull, flame]) {
      expect(mesh.positions.length % 3).toBe(0);
      expect(mesh.normals).toHaveLength(mesh.positions.length);
      expect(mesh.colors).toHaveLength(mesh.positions.length);
      expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
    }
    expect(hull.indices.length / 3).toBeGreaterThan(80);
    expect(hull.indices.length / 3).toBeLessThan(400);
  });

  it('is flat-shaded: each face has one unit normal, and it is the face\'s own', () => {
    for (const mesh of [hull, flame]) {
      triangles(mesh).forEach((face, i) => {
        const normal = mesh.normals.slice(mesh.indices[i * 3] * 3, mesh.indices[i * 3] * 3 + 3);
        expect(Math.hypot(...normal)).toBeCloseTo(1, 4);
        const geometric = cross(sub(face[1], face[0]), sub(face[2], face[0]));
        expect(dot(geometric, normal)).toBeGreaterThan(0);
        for (let k = 1; k < 3; k += 1) {
          expect(mesh.normals.slice(mesh.indices[i * 3 + k] * 3, mesh.indices[i * 3 + k] * 3 + 3)).toEqual(normal);
        }
      });
    }
  });

  it('points its nose at -z and its engines at +z, and stays inside a box a camera can frame', () => {
    const zs = [];
    for (let i = 2; i < hull.positions.length; i += 3) zs.push(hull.positions[i]);
    expect(Math.min(...zs)).toBeLessThan(-1.2);
    expect(Math.max(...zs)).toBeGreaterThan(1);
    for (let i = 0; i < hull.positions.length; i += 3) {
      expect(Math.abs(hull.positions[i])).toBeLessThan(1.5);
      expect(Math.abs(hull.positions[i + 1])).toBeLessThan(1);
    }
  });

  it('is symmetric left to right, wings and all', () => {
    const key = (x, y, z) => [x, y, z].map(v => v.toFixed(4)).join();
    const points = new Set();
    for (let i = 0; i < hull.positions.length; i += 3) {
      points.add(key(hull.positions[i], hull.positions[i + 1], hull.positions[i + 2]));
    }
    let unmatched = 0;
    for (let i = 0; i < hull.positions.length; i += 3) {
      // The hexagonal hull is symmetric about x; only rounding differs.
      if (!points.has(key(-hull.positions[i] + 0, hull.positions[i + 1], hull.positions[i + 2]))
        && !points.has(key(-hull.positions[i] - 0, hull.positions[i + 1], hull.positions[i + 2]))) unmatched += 1;
    }
    expect(unmatched).toBe(0);
  });

  it('gives the flame its own mesh, starting at the collar, so its length can change', () => {
    const zs = [];
    for (let i = 2; i < flame.positions.length; i += 3) zs.push(flame.positions[i]);
    expect(Math.min(...zs)).toBeCloseTo(FLAME_BASE_Z, 4);
    expect(Math.max(...zs)).toBeGreaterThan(FLAME_BASE_Z);
  });

  it('is warm at the nose and cool on the hull: the palette of the page', () => {
    const colorAt = i => hull.colors.slice(i * 3, i * 3 + 3);
    const warm = Array.from({ length: hull.positions.length / 3 }, (_, i) => colorAt(i)).filter(([r, , b]) => r - b > 0.3);
    const cool = Array.from({ length: hull.positions.length / 3 }, (_, i) => colorAt(i)).filter(([r, , b]) => b >= r);
    expect(warm.length).toBeGreaterThan(20);
    expect(cool.length).toBeGreaterThan(warm.length);
  });
});

describe('the matrices', () => {
  it('leave a point alone under identity, and compose right to left', () => {
    expect(transform(identity(), [1, 2, 3])).toEqual([1, 2, 3]);
    const move = multiply(translation(0, 0, -5), scaling(2));
    expect(transform(move, [1, 0, 0])).toEqual([2, 0, -5]);
  });

  it('rotate a quarter turn the way the ship banks and yaws', () => {
    const [x, y] = transform(rotationZ(Math.PI / 2), [1, 0, 0]);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(1, 5);
    const [tx, , tz] = transform(rotationY(Math.PI / 2), [0, 0, 1]);
    expect(tx).toBeCloseTo(1, 5);
    expect(tz).toBeCloseTo(0, 5);
  });

  it('project a point on the axis to the centre, nearer things larger', () => {
    const projection = perspective(Math.PI / 3, 1, 0.1, 50);
    const clip = point => { const [x, y, z] = transform(projection, point); return { x, y, z }; };
    expect(clip([0, 0, -5]).x).toBeCloseTo(0, 5);
    const near = multiply(projection, translation(0, 0, -2)), far = multiply(projection, translation(0, 0, -6));
    const w = (m, p) => { const v = [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]]; return v[0] / v[1]; };
    expect(Math.abs(w(near, [1, 0, 0]))).toBeGreaterThan(Math.abs(w(far, [1, 0, 0])));
  });

  it('carry a normal through a rotation without changing its length', () => {
    const n = normalMatrix(multiply(rotationY(0.7), rotationZ(0.3)));
    const v = [n[0] * 0 + n[3] * 1 + n[6] * 0, n[1] * 0 + n[4] * 1 + n[7] * 0, n[2] * 0 + n[5] * 1 + n[8] * 0];
    expect(Math.hypot(...v)).toBeCloseTo(1, 5);
  });
});
