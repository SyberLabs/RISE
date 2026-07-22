/**
 * ROSA MYSTICA — the Chapel's procedural rose window.
 *
 * The user's SIGILLA II engine (chapel_procedurals/rosa-mystica.html)
 * ported under the house rules. One tracery field, two renderers:
 *
 *   VITRUM — backlit stained glass and stone mullions (WebGL): golden
 *     oculus, ring of eyelets, lancet petals (vesica piscis),
 *     roundels, staggered quatrefoils, rim portholes. The medieval
 *     palette: cobalt, ruby, emerald, amber, violet.
 *
 *   VERBUM — the same field sampled at character-cell resolution,
 *     each pane spelled from Psalm 26 (DOMINVS ILLVMINATIO MEA),
 *     letters carrying the color of their glass. The Word becoming
 *     the light.
 *
 * House rules honored: fully deterministic under its seed
 * (mulberry32); the glass shimmer is the only motion and it stills
 * under prefers-reduced-motion (matching the attractor's precedent
 * for persistent fields); null-context guard; destroy() releases the
 * loop and the GL context. The rose accompanies — it never depicts
 * (spec §6 standing rule).
 *
 * Petal count (8/12/16/24) is the symmetry parameter; the seed is the
 * pane-coloring parameter.
 */

const VSRC = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FSRC = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uPet;
uniform float uSeedF;
uniform float uFlat;
uniform float uGrain;
uniform float uHue;   /* slow palette rotation, radians — the light
                         through the window turning, not the window */

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 fold(vec2 p, float n, float phase){
  float sec = 6.2831853 / n;
  float a = atan(p.y, p.x) - phase * sec;
  float idx = floor(a / sec);
  float af = a - (idx + 0.5) * sec;
  float r = length(p);
  return vec3(r * sin(af), r * cos(af), idx);
}

float sdVesica(vec2 p, float w, float h){
  float r = 0.5 * (w + h * h / w);
  float d = 0.5 * (h * h / w - w);
  p = abs(p);
  float b = sqrt(max(r * r - d * d, 0.0));
  return ((p.y - b) * d > p.x * b)
    ? length(p - vec2(0.0, b))
    : length(p - vec2(-d, 0.0)) - r;
}

vec3 pal(float k){
  if (k < 0.40) return vec3(0.10, 0.21, 0.62);
  if (k < 0.68) return vec3(0.63, 0.06, 0.13);
  if (k < 0.80) return vec3(0.06, 0.38, 0.22);
  if (k < 0.91) return vec3(0.86, 0.60, 0.16);
  return vec3(0.36, 0.15, 0.50);
}

/* hue rotation about the luma axis — each pane keeps its identity
   while the light through it slowly turns */
vec3 hueTurn(vec3 c, float a){
  const vec3 lum = vec3(0.299, 0.587, 0.114);
  float cosA = cos(a), sinA = sin(a);
  mat3 m = mat3(
    lum.x + cosA * (1.0 - lum.x) + sinA * (-lum.x),
    lum.x + cosA * (-lum.x)      + sinA * (0.143),
    lum.x + cosA * (-lum.x)      + sinA * (-(1.0 - lum.x)),
    lum.y + cosA * (-lum.y)      + sinA * (-lum.y),
    lum.y + cosA * (1.0 - lum.y) + sinA * (0.140),
    lum.y + cosA * (-lum.y)      + sinA * (lum.y),
    lum.z + cosA * (-lum.z)      + sinA * (1.0 - lum.z),
    lum.z + cosA * (-lum.z)      + sinA * (-0.283),
    lum.z + cosA * (1.0 - lum.z) + sinA * (lum.z)
  );
  return clamp(m * c, 0.0, 1.0);
}

vec3 paneColor(float ringId, float sectId){
  if (ringId < 0.5) return vec3(0.93, 0.74, 0.32);   /* the oculus holds its gold */
  float per = 1.0 + floor(hash(vec2(ringId * 3.1, uSeedF * 91.7)) * 3.0);
  float slot = mod(sectId, per);
  float k = hash(vec2(ringId * 13.7 + uSeedF * 57.0, slot * 7.1 + ringId));
  vec3 c = pal(k);
  c *= 0.90 + 0.22 * hash(vec2(sectId * 1.9 + ringId * 8.8, uSeedF * 33.0));
  return hueTurn(c, uHue);
}

vec3 tracery(vec2 p){
  float dBest = 1e3, ringId = -1.0, sectId = 0.0;
  float N = uPet;
  vec3 f;
  float d;

  d = length(p) - 0.135;
  if (d < dBest){ dBest = d; ringId = 0.0; sectId = 0.0; }

  f = fold(p, N, 0.0);
  d = length(f.xy - vec2(0.0, 0.205)) - min(0.036, 0.541 / N);
  if (d < dBest){ dBest = d; ringId = 1.0; sectId = f.z; }

  d = sdVesica(f.xy - vec2(0.0, 0.395), min(0.072, 0.968 / N), 0.150);
  if (d < dBest){ dBest = d; ringId = 2.0; sectId = f.z; }

  f = fold(p, 2.0 * N, 0.5);
  d = length(f.xy - vec2(0.0, 0.615)) - min(0.042, 0.811 / N);
  if (d < dBest){ dBest = d; ringId = 3.0; sectId = f.z; }

  f = fold(p, N, 0.5);
  vec2 q = f.xy - vec2(0.0, 0.790);
  float lobes = min(
    min(length(q - vec2(0.0,  0.041)), length(q - vec2(0.0, -0.041))),
    min(length(q - vec2( 0.041, 0.0)), length(q - vec2(-0.041, 0.0)))
  ) - 0.048;
  if (lobes < dBest){ dBest = lobes; ringId = 4.0; sectId = f.z; }

  f = fold(p, 4.0 * N, 0.0);
  d = length(f.xy - vec2(0.0, 0.945)) - 0.013;
  if (d < dBest){ dBest = d; ringId = 5.0; sectId = f.z; }

  return vec3(dBest, ringId, sectId);
}

void main(){
  float scale = 0.455 * min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / scale;
  float r = length(p);
  float aa = 1.6 / scale;

  vec3 tr = tracery(p);
  float d = tr.x + 0.011;
  float inWin = smoothstep(aa, -aa, r - 1.0);
  float glass = smoothstep(aa, -aa, d) * inWin;

  vec3 gc = paneColor(tr.y, tr.z);

  if (uFlat > 0.5){
    float cls = glass > 0.5 ? 1.0 : (inWin > 0.5 ? 0.5 : 0.0);
    gl_FragColor = vec4(gc, cls);
    return;
  }

  float drift = uGrain > 0.0 ? uTime * 0.03 : 0.0;
  float mottle = 0.6 * vnoise(p * 18.0 + uSeedF * 40.0 + drift)
               + 0.4 * vnoise(p * 47.0 - uSeedF * 21.0);
  float glow = 0.85 + 0.55 * exp(-r * r * 1.8);
  float lead = mix(0.30, 1.0, smoothstep(0.0, 1.0, clamp(-d / 0.014, 0.0, 1.0)));
  vec3 glassCol = gc * (0.55 + 0.50 * mottle) * glow * lead;
  glassCol += gc * 0.14;

  vec3 stone = vec3(0.145, 0.135, 0.120);
  stone *= 0.80 + 0.30 * vnoise(p * 34.0 + 7.0);
  stone *= mix(0.50, 1.0, smoothstep(0.0, 0.028, d));
  stone *= 0.85 + 0.25 * smoothstep(1.0, 0.2, r);

  vec3 wall = vec3(0.030, 0.027, 0.024);
  wall += vec3(0.016, 0.013, 0.008) * exp(-pow((r - 1.07) / 0.020, 2.0));
  wall *= 1.0 - 0.45 * smoothstep(0.9, 2.0, r);
  wall += gc * 0.010 * smoothstep(1.6, 1.0, r);

  vec3 col = mix(wall, mix(stone, glassCol, glass), inWin);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.7) - 0.5) * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Psalm 26 — Dominus illuminatio mea. The VERBUM lettering. */
export const ROSA_PSALM = 'DOMINVSILLVMINATIOMEA✠ETSALVSMEA✠QVEMTIMEBO✠';

export const ROSA_PETALA = Object.freeze([8, 12, 16, 24]);

/** Deterministic seed stream (mulberry32). */
export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class RosaMystica {
  /**
   * @param {HTMLElement} host - container; the engine appends its
   *   canvas (VITRUM) and pre (VERBUM) surfaces
   * @param {Object} [options] - { petala, seed, mode }
   */
  constructor(host, options = {}) {
    this.host = host;
    this.petala = ROSA_PETALA.includes(options.petala) ? options.petala : 12;
    this.seed = Number.isInteger(options.seed) ? options.seed : ((Math.random() * 0xffffff) | 0);
    this.seedF = mulberry(this.seed)();
    this.mode = options.mode === 'verbum' ? 'verbum' : 'vitrum';
    this.reduceMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._raf = null;
    this.gl = null;

    if (!host) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'rosa-canvas';
    this.pre = document.createElement('pre');
    this.pre.className = 'rosa-verbum';
    this.pre.setAttribute('aria-label', 'textual rendering of the rose window');
    host.appendChild(this.canvas);
    host.appendChild(this.pre);

    this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
    if (!this.gl) return; // null-context guard: the reading proceeds without the rose

    this._buildProgram();
    this._applyMode();
  }

  _buildProgram() {
    const gl = this.gl;
    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('[RosaMystica] shader:', gl.getShaderInfoLog(shader));
      }
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VSRC));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FSRC));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.U = {};
    for (const name of ['uRes', 'uTime', 'uPet', 'uSeedF', 'uFlat', 'uGrain', 'uHue']) {
      this.U[name] = gl.getUniformLocation(program, name);
    }
  }

  setPetala(petala) {
    if (!ROSA_PETALA.includes(petala)) return;
    this.petala = petala;
    this.renderOnce();
  }

  setMode(mode) {
    this.mode = mode === 'verbum' ? 'verbum' : 'vitrum';
    this._applyMode();
  }

  reseed(seed) {
    this.seed = Number.isInteger(seed) ? seed : ((Math.random() * 0xffffff) | 0);
    this.seedF = mulberry(this.seed)();
    this.renderOnce();
  }

  _applyMode() {
    if (!this.gl) return;
    if (this.mode === 'vitrum') {
      this.pre.classList.remove('on');
      this.canvas.style.display = 'block';
    } else {
      this.canvas.style.display = 'none';
      this.pre.classList.add('on');
    }
    this._setLoop();
  }

  _sizeCanvas() {
    const dpr = Math.min((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1, 2);
    const w = this.canvas.clientWidth || this.host.clientWidth || 640;
    const h = this.canvas.clientHeight || this.host.clientHeight || 640;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
  }

  /**
   * The light through the window turns — a full palette rotation
   * every ~6 minutes, continuous and imperceptibly slow, so the glass
   * lives across a whole reading without a single sudden change.
   * Frozen under reduced-motion (the window is then simply a window).
   */
  _hueAt(t) {
    if (this.reduceMotion) return 0;
    const CYCLE_S = 360;
    return ((t % CYCLE_S) / CYCLE_S) * Math.PI * 2;
  }

  _setCommon(t = 0) {
    this.gl.uniform1f(this.U.uPet, this.petala);
    this.gl.uniform1f(this.U.uSeedF, this.seedF);
    this.gl.uniform1f(this.U.uHue, this._hueAt(t));
  }

  _drawVitrum(t) {
    const gl = this.gl;
    this._sizeCanvas();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.U.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.U.uTime, t);
    this._setCommon(t);
    gl.uniform1f(this.U.uFlat, 0);
    gl.uniform1f(this.U.uGrain, this.reduceMotion ? 0.0 : 0.045);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _drawVerbum() {
    const gl = this.gl;
    const box = this.pre.getBoundingClientRect();
    const fs = 11, cw = fs * 0.60, lh = fs;
    const side = Math.min(box.width || 640, box.height || 640) * 0.97;
    const rows = Math.max(24, Math.floor(side / lh));
    const cols = Math.max(24, Math.floor(side / cw));

    gl.viewport(0, 0, cols, rows);
    gl.uniform2f(this.U.uRes, cols, rows);
    this._setCommon(0);
    gl.uniform1f(this.U.uFlat, 1);
    gl.uniform1f(this.U.uGrain, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const px = new Uint8Array(cols * rows * 4);
    gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, px);

    let out = '', k = 0;
    for (let y = rows - 1; y >= 0; y--) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const cls = px[i + 3];
        if (cls > 200) {
          const R = Math.min(255, Math.round(px[i] * 1.45 + 30));
          const G = Math.min(255, Math.round(px[i + 1] * 1.45 + 30));
          const B = Math.min(255, Math.round(px[i + 2] * 1.45 + 30));
          out += `<span style="color:rgb(${R},${G},${B})">`
            + ROSA_PSALM[k++ % ROSA_PSALM.length] + '</span>';
        } else if (cls > 80) {
          out += '+';
        } else {
          out += ' ';
        }
      }
      out += '\n';
    }
    this.pre.innerHTML = '<span>' + out + '</span>';
    this.pre.style.fontSize = fs + 'px';
    this.pre.style.lineHeight = lh + 'px';
  }

  renderOnce(t = 0) {
    if (!this.gl) return;
    if (this.mode === 'vitrum') this._drawVitrum(t);
    else this._drawVerbum();
  }

  _setLoop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (!this.gl) return;
    if (this.mode === 'vitrum' && !this.reduceMotion) {
      const loop = (t) => {
        this._drawVitrum(t * 0.001);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    } else {
      this.renderOnce(0);
    }
  }

  destroy() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    try { this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* released */ }
    this.gl = null;
    this.canvas?.remove();
    this.pre?.remove();
  }
}
