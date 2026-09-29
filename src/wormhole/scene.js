/**
 * The wormhole, in depth: a throat drawn by one fragment shader (the way the
 * Oracle's ball is), and the rocket as real geometry lit against it.
 *
 * The throat is a tunnel in true perspective: depth is the inverse of the
 * distance from the gate, so rings, filaments and dust all converge on it and
 * rush past faster toward the rim. Light gathers where it narrows, into an
 * event horizon with a thin chromatic ring. The rocket is lit by that gate (an
 * amber rim on every edge), by a cool key from above, and by its own engine.
 *
 * createScene returns null without WebGL2, and the page keeps its 2D picture.
 */

import { FLAME_BASE_Z, buildShip } from './ship.js';
import { multiply, normalMatrix, perspective, rotationX, rotationY, rotationZ, translation } from './gl-math.js';

const FOV = (38 * Math.PI) / 180;
const MAX_PIXELS = 1.7e6;

const FULLSCREEN = `#version 300 es
out vec2 uv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p * 2. - 1.;
  gl_Position = vec4(uv, 0., 1.);
}`;

const THROAT = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 res; uniform float t; uniform float flow; uniform float warp; uniform float open; uniform vec2 look;

float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + 1.), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * n3(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }

void main(){
  vec2 p = uv * vec2(res.x / res.y, 1.);
  p -= look * .04;                       // the picture leans a little with the reader's gaze
  p.y -= .16;                            // the gate sits above the ship
  p *= 1. - warp * .3;                   // the crossing pulls the view into the gate
  float r = length(p), a = atan(p.y, p.x);

  // Depth down the throat: the inverse of the distance from the gate.
  // The range is wide enough that several rings show between the rim and the gate.
  float z = 1.35 / (r + .08);
  float v = z + flow;

  // The wall: filaments spiralling down, and rings along the throat, which
  // are what the eye reads as distance.
  float tw = a + v * .16;                                  // the wall's veins spiral as they run down
  vec3 q = vec3(cos(tw) * 3.4, sin(tw) * 3.4, v * .55);
  float d = fbm(q + fbm(q * 1.4 + t * .04) * .55);
  float fil = smoothstep(.045, .0, abs(d - .52));
  float body = smoothstep(.3, .82, d);
  float rib = pow(1. - abs(fract(v * .75) - .5) * 2., 9.);
  float frame = pow(1. - abs(fract(v * .25) - .5) * 2., 26.);      // a heavier ring every third
  vec3 deep = vec3(.010, .030, .062);
  vec3 teal = vec3(.16, .56, .54);
  vec3 mint = vec3(.72, .92, .82);
  vec3 col = deep + teal * body * .26 + teal * fil * .85 + mint * rib * (.34 + fil * .5) + mint * frame * .9;

  // Light gathers as the throat narrows; the rim, near the camera, falls to dark.
  float toward = smoothstep(1.55, .06, r);
  col *= .34 + 1.25 * toward;
  col += vec3(.03, .12, .14) * toward * toward * 1.4;               // haze gathering toward the gate

  // Dust and starlight streaming past: each mote has its own bearing and depth,
  // and in the crossing each becomes a streak trailing back toward the gate.
  for (int i = 0; i < 30; i++){
    float fi = float(i);
    float ang = h1(fi + 1.) * 6.2831853;
    float dep = fract(h1(fi + 9.) + flow * .12);
    float rr = .045 + pow(dep, 2.1) * 1.55;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 c = dir * rr;
    float len = (.006 + dep * .05) * (1. + warp * 12.);
    vec2 dd = p - c;
    float along = dot(dd, dir);
    float across = length(dd - dir * clamp(along, -len, 0.));
    float size = .0045 * (.35 + dep * 1.4);
    vec3 tint = h1(fi + 3.) > .8 ? vec3(1., .72, .5) : mint;
    col += tint * smoothstep(size, 0., across) * (.25 + dep) * .9;
  }

  // The gate: an event horizon of amber and cream, ringed by a thin, split line of light.
  float gr = .25 + open * .06;
  float horizon = smoothstep(gr, gr * .35, r);
  vec3 core = mix(vec3(.90, .62, .40), vec3(1., .95, .82), smoothstep(gr * .7, 0., r));
  // Inside the gate there is only light: deep teal at the lip, amber-cream at the heart.
  vec3 through = mix(vec3(.05, .17, .19), core, smoothstep(gr * .95, 0., r) * (.85 + open * .15));
  through += vec3(1., .82, .62) * exp(-r * 14.) * (.35 + open * .5);
  col = mix(col, through * (1. + open * .5), horizon);
  // Chromatic ring at the lip.
  vec3 ring = vec3(smoothstep(.014, 0., abs(r - gr - .004)),
                   smoothstep(.014, 0., abs(r - gr)),
                   smoothstep(.014, 0., abs(r - gr + .004)));
  col += ring * mix(vec3(.8, 1., .95), vec3(1., .82, .6), open) * (.9 + warp);
  // A soft halo, wider when open.
  col += mix(vec3(.25, .6, .55), vec3(.9, .55, .3), open) * exp(-abs(r - gr) * 9.) * (.16 + open * .2 + warp * .25);

  col *= smoothstep(1.9, .7, r);         // vignette
  col += (h3(vec3(gl_FragCoord.xy, t)) - .5) * .012;
  col = 1. - exp(-col * 1.35);
  o = vec4(pow(col, vec3(.95)), 1.);
}`;

const SHIP_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
uniform mat4 uMVP; uniform mat4 uModel; uniform mat3 uNormal; uniform float uFlame;
out vec3 vNormal; out vec3 vColor; out vec3 vWorld; out float vEmit;
const float FLAME_BASE = ${FLAME_BASE_Z.toFixed(3)};
void main(){
  vec3 p = aPos;
  float along = 0.;
  if (uFlame > 0.) { along = clamp((p.z - FLAME_BASE), 0., 1.); p.z = FLAME_BASE + along * uFlame; }
  vNormal = uNormal * aNormal;
  vColor = aColor;
  vEmit = along;
  vWorld = (uModel * vec4(p, 1.)).xyz;
  gl_Position = uMVP * vec4(p, 1.);
}`;

const SHIP_FRAG = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vColor; in vec3 vWorld; in float vEmit; out vec4 o;
uniform float uFlame; uniform float uOpen; uniform float uEngine;
void main(){
  if (uFlame > 0.) {
    float fade = 1. - vEmit;
    vec3 hot = mix(vec3(1., .88, .68), vec3(.96, .42, .18), vEmit);
    o = vec4(hot * fade * fade * 1.5, fade);
    return;
  }
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vWorld);
  vec3 keyDir = normalize(vec3(-.45, .85, .4));
  vec3 gateDir = normalize(vec3(0., .12, -1.));
  float key = max(dot(n, keyDir), 0.);
  float gate = max(dot(n, gateDir), 0.);
  float fres = pow(1. - max(dot(n, v), 0.), 2.4);
  vec3 amb = mix(vec3(.05, .08, .11), vec3(.17, .32, .35), n.y * .5 + .5);
  vec3 lit = amb + vec3(.82, .93, .96) * key * .8 + vec3(1., .72, .5) * gate * (.3 + uOpen * .55);
  vec3 col = vColor * lit;
  col += vec3(.98, .64, .42) * fres * (.35 + gate * .5 + uOpen * .5);
  vec3 hv = normalize(keyDir + v);
  col += vec3(.9, .97, 1.) * pow(max(dot(n, hv), 0.), 44.) * .6 * key;
  col += vec3(1., .6, .35) * max(n.z, 0.) * uEngine * .4;
  o = vec4(pow(col, vec3(.92)), 1.);
}`;

function program(gl, vertex, fragment) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const linked = gl.createProgram();
  gl.attachShader(linked, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(linked, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(linked);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(linked));
  return linked;
}

function upload(gl, mesh) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  [[mesh.positions, 0], [mesh.normals, 1], [mesh.colors, 2]].forEach(([data, location]) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  });
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: mesh.indices.length };
}

export function createScene(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  let lost = false, throat, ship, hull, flame, aspect = 1, width = 1, height = 1;
  const ships = buildShip();

  function init() {
    throat = program(gl, FULLSCREEN, THROAT);
    ship = program(gl, SHIP_VERT, SHIP_FRAG);
    hull = upload(gl, ships.hull);
    flame = upload(gl, ships.flame);
  }
  try { init(); } catch (error) { console.warn('[Wormhole] renderer unavailable', error); return null; }

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    canvas.dispatchEvent(new CustomEvent('scene-lost'));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try { init(); lost = false; canvas.dispatchEvent(new CustomEvent('scene-restored')); } catch { /* stays on the 2D picture */ }
  });

  return {
    resize(cssWidth, cssHeight, dpr) {
      const scale = Math.min(dpr, Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight)));
      width = canvas.width = Math.max(1, Math.round(cssWidth * scale));
      height = canvas.height = Math.max(1, Math.round(cssHeight * scale));
      aspect = width / height;
      gl.viewport(0, 0, width, height);
    },

    /** scene: { time, flow, thrust, open }; pose: from shipPose; look: [-1..1, -1..1]. */
    draw(scene, pose, look = [0, 0]) {
      if (lost) return;
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(throat);
      gl.uniform2f(gl.getUniformLocation(throat, 'res'), width, height);
      gl.uniform1f(gl.getUniformLocation(throat, 't'), scene.time);
      gl.uniform1f(gl.getUniformLocation(throat, 'flow'), scene.flow);
      gl.uniform1f(gl.getUniformLocation(throat, 'warp'), scene.thrust);
      gl.uniform1f(gl.getUniformLocation(throat, 'open'), scene.open);
      gl.uniform2f(gl.getUniformLocation(throat, 'look'), look[0], look[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const model = multiply(translation(pose.x, pose.y, pose.z),
        multiply(rotationY(pose.yaw), multiply(rotationX(pose.pitch), rotationZ(pose.bank))));
      const mvp = multiply(perspective(FOV, aspect, 0.1, 60), model);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(ship);
      gl.uniformMatrix4fv(gl.getUniformLocation(ship, 'uMVP'), false, mvp);
      gl.uniformMatrix4fv(gl.getUniformLocation(ship, 'uModel'), false, model);
      gl.uniformMatrix3fv(gl.getUniformLocation(ship, 'uNormal'), false, normalMatrix(model));
      gl.uniform1f(gl.getUniformLocation(ship, 'uOpen'), scene.open);
      gl.uniform1f(gl.getUniformLocation(ship, 'uEngine'), Math.min(1, 0.3 + scene.thrust));
      gl.uniform1f(gl.getUniformLocation(ship, 'uFlame'), 0);
      gl.bindVertexArray(hull.vao);
      gl.drawElements(gl.TRIANGLES, hull.count, gl.UNSIGNED_SHORT, 0);

      // The flame adds light and does not occlude.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.uniform1f(gl.getUniformLocation(ship, 'uFlame'), Math.max(0.05, pose.flame));
      gl.bindVertexArray(flame.vao);
      gl.drawElements(gl.TRIANGLES, flame.count, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }
  };
}
