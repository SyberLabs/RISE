/** Just enough 4x4 matrix arithmetic for one camera and one model. Column-major, as GL wants. */

export const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** a × b: apply b, then a. */
export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function translation(x, y, z) {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

export function scaling(s) {
  const out = identity();
  out[0] = out[5] = out[10] = s;
  return out;
}

export function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle), out = identity();
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

export function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle), out = identity();
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function rotationZ(angle) {
  const c = Math.cos(angle), s = Math.sin(angle), out = identity();
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

/** The upper 3x3 of a matrix, for carrying normals (no scaling or shear is used, so no inverse is needed). */
export function normalMatrix(m) {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}

/** Apply a matrix to a point. */
export function transform(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ];
}
