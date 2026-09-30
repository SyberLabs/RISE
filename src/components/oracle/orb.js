// The Oracle: a 1982 object with an impossible screen.
//
// One fragment shader draws the whole instrument: a glossy black polycarbonate
// sphere, a brushed chrome bezel, and a round CRT window that is not a flat tube
// but a view into a deep volume of phosphor fluid. Orientation and "churn" are
// driven from JavaScript so the HTML text layer can ride the same window.
//
// Coordinates: sphere radius 1 at the origin, camera on +z looking at it.
// The window faces +z in object space. rot is the object-to-world rotation.

const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p; gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 res; uniform float t; uniform float churn; uniform float glow; uniform float cam; uniform float fit;
uniform mat3 rot; uniform float winCos;

float h(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + 1.), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * n3(p); p = p * 2.03 + 11.7; a *= .5; } return s; }

// The fluid behind the glass: cobalt and violet phosphor with ice-bright filaments.
vec3 fluid(vec3 ro, vec3 rd, float far){
  vec3 acc = vec3(0.); float T = 1.; float dt = far / 14.;
  for (int i = 0; i < 14; i++){
    vec3 q = ro + rd * (float(i) + .5) * dt;
    vec3 qo = transpose(rot) * q;                       // swirl in object space so it rides the sphere
    float sw = t * (.12 + .9 * churn);
    vec3 w = qo * 1.7 + vec3(sin(sw + qo.z * 2.), cos(sw * .8 + qo.x * 2.3), sw * .6);
    float d = fbm(w + fbm(w * 1.4 - sw) * (1.2 + 2.2 * churn));
    float fil = smoothstep(.02, .0, abs(d - .52)) * 1.4;  // thin bright sheets where the field crosses a level
    float dens = smoothstep(.38, .78, d) * .9 + fil;
    float depth = length(q) ;                             // deeper = further toward the center
    vec3 col = mix(vec3(.02, .19, .94), vec3(.36, .23, .84), smoothstep(.25, .75, n3(w * .6 + 3.)));
    col = mix(col, vec3(.56, .85, .94), fil * .8);
    col += vec3(.94, .85, .85) * fil * smoothstep(.6, 1., n3(w + 9.)) * .5; // the mark's peach sheen, rarely
    acc += T * col * dens * dt * (2.2 + glow * 2.5) * (1.2 - depth * .5);
    T *= exp(-dens * dt * 1.6);
  }
  return acc;
}

void main(){
  vec2 q = uv * vec2(res.x / res.y, 1.) / fit;
  vec3 ro = vec3(0., 0., cam), rd = normalize(vec3(q, -cam + 1.35));
  // background: the room is dark; the object sits in a low cobalt haze
  float b = dot(ro, rd), c = dot(ro, ro) - 1., disc = b * b - c;
  if (disc < 0.){ o = vec4(0.); return; }
  float th = -b - sqrt(disc);
  vec3 p = ro + rd * th, n = normalize(p), no = transpose(rot) * n, v = -rd;
  float fres = pow(1. - max(dot(n, v), 0.), 3.);
  vec3 L1 = normalize(vec3(-.55, .75, .6)), L2 = normalize(vec3(.8, .1, .4));
  vec3 rf = reflect(rd, n);
  // softbox reflections: a big key panel up-left, a thin strip right
  // softbox reflections: a tight key up-left, a thin strip right
  float kd = dot(rf, L1), sd = dot(rf, L2);
  float key = smoothstep(.9, .975, kd) * .8 + pow(max(kd, 0.), 30.) * .3;
  float strip = smoothstep(.984, .996, sd) * .45;
  float w = dot(no, vec3(0, 0, 1));
  vec3 col;
  if (w > winCos){
    // glass: refract into the fluid, then lay a CRT over it
    vec3 rr = refract(rd, n, 1. / 1.5);
    float b2 = dot(p, rr), c2 = dot(p, p) - 1.;
    float far = -b2 + sqrt(max(b2 * b2 - c2, 0.));
    col = fluid(p, rr, far * .95);
    float r = acos(clamp(w, -1., 1.)) / acos(winCos);     // 0 center -> 1 edge of the window
    col = col * col * 1.6;                                // phosphor contrast: deep blacks, bright filaments
    col *= mix(.38, 1., smoothstep(.12, .78, r));         // a dark well behind the words
    col *= 1. - smoothstep(.62, 1., r) * .6;             // tube vignette
    float line = .78 + .22 * sin(gl_FragCoord.y * 3.14159 / 1.5);
    vec3 mask = vec3(1.) + .07 * vec3(sin(gl_FragCoord.x * 2.094), sin(gl_FragCoord.x * 2.094 + 2.094), sin(gl_FragCoord.x * 2.094 + 4.188));
    col *= line * mask;
    col += vec3(.02, .05, .12) * (1. - r);                // phosphor floor, never fully black
    col += vec3(1.) * key * .22 + vec3(.7, .85, 1.) * strip * .35 + fres * vec3(.05, .1, .25);
  } else if (w > winCos - .05){
    // brushed chrome bezel: anisotropic streaks around the rim
    float a = atan(no.y, no.x);
    float brush = .75 + .25 * n3(vec3(a * 90., w * 400., 0.));
    float bev = smoothstep(winCos - .05, winCos - .025, w) * (1. - smoothstep(winCos - .01, winCos, w));
    col = vec3(.55, .58, .64) * brush * (.35 + .65 * max(dot(n, L1), 0.)) + key * .8 + strip * .5;
    col *= .55 + .45 * bev;
  } else {
    // polycarbonate shell: deep black, glossy, a cobalt rim
    float diff = max(dot(n, L1), 0.) * .03 + max(dot(n, L2), 0.) * .015;
    float env = mix(.006, .07, smoothstep(-.3, .9, rf.y)) * (.4 + .6 * fres);          // the room's ceiling, reflected
    float broad = pow(max(dot(rf, L1), 0.), 5.) * .16;
    col = vec3(.014, .015, .02) + diff + env + broad + vec3(1.) * key * .85 + vec3(.75, .85, 1.) * strip * 1.2;
    col += pow(fres, 2.) * vec3(.02, .08, .38) * .7;
    col += (h(vec3(gl_FragCoord.xy, t)) - .5) * .012;   // grain, so the black reads as a material
  }
  // contact occlusion toward the floor
  col *= mix(1., .55, smoothstep(.1, -1., n.y) * .6);
  o = vec4(pow(col, vec3(.95)), 1.);
}`;

function rotation(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Rz(roll) * Rx(pitch) * Ry(yaw), column-major for GLSL
  const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const Rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
  const Rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
  const mul = (A, B) => { const o = new Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = A[r] * B[c * 3] + A[3 + r] * B[c * 3 + 1] + A[6 + r] * B[c * 3 + 2]; return o; };
  return mul(Rz, mul(Rx, Ry));
}

export const CAMERA = 4.2;   // camera distance in sphere radii
export const FOCAL = 2.85;   // matches rd = normalize(q, -(cam - 1.35))
export const WINDOW_COS = Math.cos(0.52);

export function createOrb(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  let lost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; canvas.dispatchEvent(new CustomEvent('oracle-lost')); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; init(); canvas.dispatchEvent(new CustomEvent('oracle-restored')); });
  let u;
  function init() {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = name => gl.getUniformLocation(prog, name);
    u = { res: U('res'), t: U('t'), churn: U('churn'), glow: U('glow'), cam: U('cam'), fit: U('fit'), rot: U('rot'), winCos: U('winCos') };
  }
  init();

  return {
    resize(w, h, dpr) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height); },
    draw({ time, yaw, pitch, roll, churn, glow, fit }) {
      if (lost) return;
      gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform1f(u.t, time); gl.uniform1f(u.churn, churn); gl.uniform1f(u.glow, glow);
      gl.uniform1f(u.cam, CAMERA); gl.uniform1f(u.fit, fit); gl.uniform1f(u.winCos, WINDOW_COS);
      gl.uniformMatrix3fv(u.rot, false, rotation(yaw, pitch, roll));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
