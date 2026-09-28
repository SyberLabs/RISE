/**
 * WebGL2 fractal-flame renderer.
 *
 * Particles live in two vertex buffers and are advanced by transform
 * feedback (ping-pong). Each iteration pass is also drawn as one-pixel
 * points into an accumulation target with additive blending; the target
 * decays a little each frame, which bounds both brightness and trail
 * lifetime. A final pass tone-maps log density. There is no per-frame CPU
 * readback: pixels are read only by the capability probe and explicit
 * capture.
 *
 * This module never touches a canvas that already holds another context:
 * it is always handed a canvas it created for WebGL2 alone.
 */

const MAX_TRANSFORMS = 8;
const BURN_IN_AGE = 12;
const HASH = `
uint hash(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
float rand(inout uint s) { s = hash(s); return float(s) * (1.0 / 4294967296.0); }
`;

const UPDATE_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec4 aState;
out vec4 vState;
uniform int uCount;
uniform vec3 uRowA[${MAX_TRANSFORMS}];
uniform vec3 uRowB[${MAX_TRANSFORMS}];
uniform vec3 uVarA[${MAX_TRANSFORMS}];
uniform vec3 uVarB[${MAX_TRANSFORMS}];
uniform float uCum[${MAX_TRANSFORMS}];
uniform float uColor[${MAX_TRANSFORMS}];
uniform uint uSeed;
uniform float uReset;
${HASH}
vec2 variations(vec2 p, vec3 a, vec3 b) {
  float r2 = dot(p, p);
  float r = sqrt(r2);
  vec2 o = a.x * p;
  o += a.y * sin(p);
  o += a.z * p / max(r2, 1e-6);
  float s = sin(r2);
  float c = cos(r2);
  o += b.x * vec2(p.x * s - p.y * c, p.x * c + p.y * s);
  o += b.y * vec2((p.x - p.y) * (p.x + p.y), 2.0 * p.x * p.y) / max(r, 1e-6);
  o += b.z * vec2(atan(p.y, p.x) / 3.14159265, r - 1.0);
  return o;
}
void main() {
  uint s = hash(uint(gl_VertexID) * 747796405u + uSeed);
  vec4 st = aState;
  if (uReset > 0.5) st = vec4(rand(s) * 2.0 - 1.0, rand(s) * 2.0 - 1.0, rand(s), 0.0);
  float pick = rand(s);
  int k = 0;
  for (int i = 0; i < ${MAX_TRANSFORMS}; i++) {
    if (i >= uCount) break;
    k = i;
    if (pick <= uCum[i]) break;
  }
  vec3 h = vec3(st.xy, 1.0);
  vec2 p = variations(vec2(dot(uRowA[k], h), dot(uRowB[k], h)), uVarA[k], uVarB[k]);
  bool bad = p.x != p.x || p.y != p.y || abs(p.x) > 1e4 || abs(p.y) > 1e4;
  vState = bad
    ? vec4(rand(s) * 2.0 - 1.0, rand(s) * 2.0 - 1.0, rand(s), 0.0)
    : vec4(p, (st.z + uColor[k]) * 0.5, min(st.w + 1.0, 4096.0));
}`;

const EMPTY_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0); }`;

const POINT_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec4 aState;
uniform vec4 uCamera;
uniform vec2 uAspect;
uniform int uSymmetry;
uniform uint uSeed;
out float vColor;
${HASH}
void main() {
  if (aState.w < ${BURN_IN_AGE}.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 1.0;
    vColor = 0.0;
    return;
  }
  uint s = hash(uint(gl_VertexID) * 2654435761u ^ uSeed);
  float turn = floor(rand(s) * float(uSymmetry)) * 6.28318531 / float(uSymmetry);
  float angle = uCamera.w + turn;
  vec2 w = aState.xy - uCamera.xy;
  vec2 p = vec2(w.x * cos(angle) - w.y * sin(angle), w.x * sin(angle) + w.y * cos(angle));
  p *= uCamera.z * uAspect;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  gl_PointSize = 1.0;
  vColor = clamp(aState.z, 0.0, 1.0);
}`;

const POINT_FS = `#version 300 es
precision highp float;
uniform sampler2D uPalette;
uniform float uWeight;
in float vColor;
out vec4 o;
void main() {
  o = vec4(texture(uPalette, vec2(vColor, 0.5)).rgb, 1.0) * uWeight;
}`;

const QUAD_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const TONE_FS = `#version 300 es
precision highp float;
uniform sampler2D uAcc;
uniform float uExposure;
uniform float uGamma;
uniform float uVibrancy;
uniform float uScale;
uniform float uFade;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 a = texture(uAcc, vUv);
  if (a.a <= 1e-6) { o = vec4(0.0); return; }
  float alpha = 1.0 - exp(-uExposure * log(1.0 + a.a * uScale));
  float lifted = pow(alpha, 1.0 / uGamma);
  vec3 average = clamp(a.rgb / a.a, 0.0, 1.0);
  vec3 vivid = average * lifted;
  vec3 plain = pow(average * alpha, vec3(1.0 / uGamma));
  vec3 color = mix(plain, vivid, uVibrancy) * uFade;
  o = vec4(color, max(lifted, max(color.r, max(color.g, color.b))) * uFade);
}`;

const PROBE_FS = `#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.75); }`;

const PROBE_VS = `#version 300 es
void main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0; }`;

export class FlameGpuError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FlameGpuError';
    this.code = code;
  }
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) || 'unknown';
    gl.deleteShader(shader);
    throw new FlameGpuError('SHADER_COMPILE', `Flame shader failed to compile: ${log.slice(0, 200)}`);
  }
  return shader;
}

function program(gl, vs, fs, feedback = null) {
  const prog = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  if (feedback) gl.transformFeedbackVaryings(prog, feedback, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(prog) || 'unknown';
    gl.deleteProgram(prog);
    throw new FlameGpuError('SHADER_LINK', `Flame program failed to link: ${log.slice(0, 200)}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/u, '');
    uniforms[name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, uniforms };
}

function halfToFloat(h) {
  const exponent = (h >> 10) & 0x1f;
  const mantissa = h & 0x3ff;
  const sign = h & 0x8000 ? -1 : 1;
  if (exponent === 0) return sign * 2 ** -14 * (mantissa / 1024);
  if (exponent === 31) return mantissa ? NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + mantissa / 1024);
}

/**
 * Prove additive accumulation into an RGBA16F target: framebuffer
 * completeness alone does not prove blending works, so two 0.75 points are
 * blended and read back. A value near 1.5 means unclamped additive blending.
 */
function probeFloatBlend(gl) {
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
    return { ok: false, reason: 'no-float-color-buffer' };
  }
  gl.getExtension('EXT_float_blend');
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  let probe = null;
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      return { ok: false, reason: 'incomplete-float-framebuffer' };
    }
    probe = program(gl, PROBE_VS, PROBE_FS);
    gl.viewport(0, 0, 1, 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(probe.prog);
    gl.drawArrays(gl.POINTS, 0, 1);
    gl.drawArrays(gl.POINTS, 0, 1);
    gl.disable(gl.BLEND);
    const format = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
    const type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
    let value = NaN;
    if (format === gl.RGBA && type === gl.FLOAT) {
      const out = new Float32Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out);
      value = out[0];
    } else if (format === gl.RGBA && type === gl.HALF_FLOAT) {
      const out = new Uint16Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.HALF_FLOAT, out);
      value = halfToFloat(out[0]);
    } else {
      const out = new Float32Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out);
      value = out[0];
    }
    const ok = gl.getError() === gl.NO_ERROR && value > 1.2 && value < 1.8;
    return { ok, reason: ok ? 'float-blend-verified' : `float-blend-probe-${Number.isFinite(value) ? value.toFixed(2) : 'unreadable'}` };
  } catch {
    return { ok: false, reason: 'float-probe-error' };
  } finally {
    if (probe) gl.deleteProgram(probe.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    while (gl.getError() !== gl.NO_ERROR) { /* drain probe errors */ }
  }
}

export class FlameGpuRenderer {
  /**
   * @param {HTMLCanvasElement} canvas a canvas used only for WebGL2
   */
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new FlameGpuError('WEBGL2_UNAVAILABLE', 'WebGL2 is not available.');
    this.gl = gl;
    this.particles = 0;
    this.width = 0;
    this.height = 0;
    this.float = false;
    this.floatReason = 'unprobed';
    this._init();
  }

  _init() {
    const gl = this.gl;
    const probe = probeFloatBlend(gl);
    this.float = probe.ok;
    this.floatReason = probe.reason;
    this.update = program(gl, UPDATE_VS, EMPTY_FS, ['vState']);
    this.points = program(gl, POINT_VS, POINT_FS);
    this.tone = program(gl, QUAD_VS, TONE_FS);
    this.fade = program(gl, QUAD_VS, EMPTY_FS);
    this.palette = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(1024));
    this.feedback = gl.createTransformFeedback();
    this.emptyVao = gl.createVertexArray();
    this.buffers = [];
    this.vaos = [];
    this.accTexture = null;
    this.accFramebuffer = null;
    this.current = 0;
    this.seedCounter = 1;
    this.needsReset = true;
  }

  get contextLost() {
    return this.gl.isContextLost();
  }

  /** Allocate particle buffers; changing the count resets the history. */
  setParticleCount(count) {
    const gl = this.gl;
    if (count === this.particles && this.buffers.length) return;
    this._releaseParticles();
    this.particles = count;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < 2; i += 1) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      this.buffers.push(buffer);
      this.vaos.push(vao);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.needsReset = true;
  }

  _releaseParticles() {
    const gl = this.gl;
    this.buffers.forEach(buffer => gl.deleteBuffer(buffer));
    this.vaos.forEach(vao => gl.deleteVertexArray(vao));
    this.buffers = [];
    this.vaos = [];
  }

  /** Resize the drawing buffer and accumulation target (clears history). */
  setSize(width, height) {
    const gl = this.gl;
    if (width === this.width && height === this.height && this.accTexture) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.accTexture) gl.deleteTexture(this.accTexture);
    if (this.accFramebuffer) gl.deleteFramebuffer(this.accFramebuffer);
    this.accTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.accTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.float) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    this.accFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accTexture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
      throw new FlameGpuError('FRAMEBUFFER', 'The flame accumulation target is incomplete.');
    }
    this.clearHistory();
  }

  setPalette(lut) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, lut);
  }

  clearHistory() {
    const gl = this.gl;
    if (!this.accFramebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFramebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Restart particles from random seeds with burn-in; clears history. */
  reset() {
    this.needsReset = true;
    this.clearHistory();
  }

  _setFrameUniforms(frame) {
    const gl = this.gl;
    const u = this.update.uniforms;
    const count = Math.min(frame.transforms.length, MAX_TRANSFORMS);
    const rowA = new Float32Array(MAX_TRANSFORMS * 3);
    const rowB = new Float32Array(MAX_TRANSFORMS * 3);
    const varA = new Float32Array(MAX_TRANSFORMS * 3);
    const varB = new Float32Array(MAX_TRANSFORMS * 3);
    const cum = new Float32Array(MAX_TRANSFORMS).fill(1);
    const color = new Float32Array(MAX_TRANSFORMS);
    for (let i = 0; i < count; i += 1) {
      const item = frame.transforms[i];
      const [a, b, c, d, e, f] = item.affine;
      rowA.set([a, b, c], i * 3);
      rowB.set([d, e, f], i * 3);
      const w = item.variations;
      varA.set([w.linear, w.sinusoidal, w.spherical], i * 3);
      varB.set([w.swirl, w.horseshoe, w.polar], i * 3);
      cum[i] = item.cumulative;
      color[i] = item.color;
    }
    gl.useProgram(this.update.prog);
    gl.uniform1i(u.uCount, count);
    gl.uniform3fv(u.uRowA, rowA);
    gl.uniform3fv(u.uRowB, rowB);
    gl.uniform3fv(u.uVarA, varA);
    gl.uniform3fv(u.uVarB, varB);
    gl.uniform1fv(u.uCum, cum);
    gl.uniform1fv(u.uColor, color);
  }

  /**
   * Advance and accumulate one displayed frame.
   * @param {object} frame from resolveFlameFrame
   * @param {object} options passes: iteration passes; decay: history kept
   *   per frame; draw: whether to tone-map to the canvas; fade: 0..1 output
   */
  render(frame, { passes = 2, decay = 0.93, draw = true, fade = 1, burnIn = 14 } = {}) {
    const gl = this.gl;
    if (gl.isContextLost() || !this.buffers.length || !this.accFramebuffer) return false;
    this._setFrameUniforms(frame);
    const pointU = this.points.uniforms;
    const aspect = this.width / Math.max(1, this.height);
    const reset = this.needsReset;
    this.needsReset = false;
    const iterate = (drawPoints, resetPass) => {
      const source = this.current;
      const target = 1 - source;
      gl.useProgram(this.update.prog);
      gl.uniform1ui(this.update.uniforms.uSeed, (this.seedCounter++ * 0x9e3779b1) >>> 0);
      gl.uniform1f(this.update.uniforms.uReset, resetPass ? 1 : 0);
      gl.bindVertexArray(this.vaos[source]);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[target]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, this.particles);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      this.current = target;
      if (!drawPoints) return;
      gl.useProgram(this.points.prog);
      gl.uniform1ui(pointU.uSeed, (this.seedCounter * 0x85ebca6b) >>> 0);
      gl.bindVertexArray(this.vaos[target]);
      gl.drawArrays(gl.POINTS, 0, this.particles);
    };

    if (reset) {
      this.clearHistory();
      iterate(false, true);
      for (let i = 1; i < burnIn; i += 1) iterate(false, false);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFramebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.BLEND);
    // Decay the history first: dst = dst * decay. This bounds exposure and
    // keeps motion from smearing into persistent trails.
    if (decay < 1) {
      gl.blendColor(0, 0, 0, decay);
      gl.blendFunc(gl.ZERO, gl.CONSTANT_ALPHA);
      gl.useProgram(this.fade.prog);
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.points.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.uniform1i(pointU.uPalette, 0);
    gl.uniform1f(pointU.uWeight, this.float ? 1 : 4 / 255);
    gl.uniform4f(pointU.uCamera, frame.camera.x, frame.camera.y, frame.camera.zoom, frame.camera.rotation);
    gl.uniform2f(pointU.uAspect, aspect >= 1 ? 1 / aspect : 1, aspect >= 1 ? 1 : aspect);
    gl.uniform1i(pointU.uSymmetry, Math.max(1, frame.symmetry | 0));
    for (let i = 0; i < passes; i += 1) iterate(true, false);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (draw) this.present(frame, { passes, decay, fade });
    return true;
  }

  /** Tone-map the accumulation to the canvas. */
  present(frame, { passes = 2, decay = 0.93, fade = 1 } = {}) {
    const gl = this.gl;
    const u = this.tone.uniforms;
    const pixels = this.width * this.height;
    const steady = this.particles * passes / Math.max(0.02, 1 - decay);
    const weight = this.float ? 1 : 4 / 255;
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.tone.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.accTexture);
    gl.uniform1i(u.uAcc, 0);
    gl.uniform1f(u.uExposure, frame.tone.exposure);
    gl.uniform1f(u.uGamma, frame.tone.gamma);
    gl.uniform1f(u.uVibrancy, frame.tone.vibrancy);
    gl.uniform1f(u.uScale, (6 * pixels) / Math.max(1, steady) / weight);
    gl.uniform1f(u.uFade, Math.max(0, Math.min(1, fade)));
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Explicit capture: the only readback outside the probe. */
  capture() {
    return this.canvas.toDataURL('image/png');
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    this._releaseParticles();
    if (!gl.isContextLost()) {
      gl.deleteProgram(this.update?.prog);
      gl.deleteProgram(this.points?.prog);
      gl.deleteProgram(this.tone?.prog);
      gl.deleteProgram(this.fade?.prog);
      gl.deleteTexture(this.palette);
      gl.deleteTexture(this.accTexture);
      gl.deleteFramebuffer(this.accFramebuffer);
      gl.deleteTransformFeedback(this.feedback);
      gl.deleteVertexArray(this.emptyVao);
    }
    this.accTexture = null;
    this.accFramebuffer = null;
    // Release the context eagerly so repeated scene changes cannot exhaust
    // the browser's context budget.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }

  /** Rebuild GPU objects after a restored context. */
  restore() {
    this.buffers = [];
    this.vaos = [];
    this.accTexture = null;
    this.accFramebuffer = null;
    const particles = this.particles;
    const width = this.width;
    const height = this.height;
    this.particles = 0;
    this.width = 0;
    this.height = 0;
    this._init();
    if (particles) this.setParticleCount(particles);
    if (width && height) this.setSize(width, height);
  }
}
