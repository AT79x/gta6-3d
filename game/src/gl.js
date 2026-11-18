// Solmar Bay 3D — a tiny WebGL renderer written from scratch: one shader pair,
// one unit-cube mesh, column-major 4x4 matrix helpers, and a box() call that
// draws any coloured box anywhere. No library, no textures, no network.
import { PALETTE } from './config.js';

const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec4 vp = uView * wp;
  vNormal = mat3(uModel) * aNormal;
  vColor = uColor;
  vDepth = -vp.z;
  gl_Position = uProj * vp;
}
`;

const FRAG_SRC = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
uniform vec3 uLightDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAmbient;
uniform float uSun;
void main() {
  float d = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
  vec3 col = vColor * (uAmbient + uSun * d);
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}
`;

// ---- 4x4 matrices, column-major Float32Array(16), as WebGL expects. ----
export function matIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

/** out = a * b (apply b first, then a). */
export function matMultiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

export function matPerspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm3(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function matLookAt(eye, center, up) {
  const z = norm3(sub3(eye, center));
  const x = norm3(cross3(up, z));
  const y = cross3(z, x);
  const out = matIdentity();
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0];
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1];
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2];
  out[12] = -dot3(x, eye);
  out[13] = -dot3(y, eye);
  out[14] = -dot3(z, eye);
  return out;
}

export function matTranslate(x, y, z) {
  const out = matIdentity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function matRotateY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out = matIdentity();
  out[0] = c; out[2] = -s;
  out[8] = s; out[10] = c;
  return out;
}

export function matScale(sx, sy, sz) {
  const out = matIdentity();
  out[0] = sx; out[5] = sy; out[10] = sz;
  return out;
}

/** Model matrix: translate, then rotate around Y, then scale. */
export function matCompose(x, y, z, rotY, sx, sy, sz) {
  return matMultiply(matTranslate(x, y, z), matMultiply(matRotateY(rotY), matScale(sx, sy, sz)));
}

/** Multiply a 4x4 matrix by a vec4, returning [x, y, z, w]. */
export function matVec4(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}

// A unit cube centred on the origin, half-size 0.5, one quad per face with an
// outward normal, built from a face table so no vertex is typed twice.
const CUBE_FACES = [
  { n: [1, 0, 0], c: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { n: [-1, 0, 0], c: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
  { n: [0, 1, 0], c: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
  { n: [0, -1, 0], c: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  { n: [0, 0, 1], c: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { n: [0, 0, -1], c: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
];

function buildCube() {
  const pos = [];
  const nor = [];
  const idx = [];
  for (let f = 0; f < CUBE_FACES.length; f += 1) {
    const face = CUBE_FACES[f];
    for (let v = 0; v < 4; v += 1) {
      pos.push(face.c[v][0], face.c[v][1], face.c[v][2]);
      nor.push(face.n[0], face.n[1], face.n[2]);
    }
    const base = f * 4;
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}

export class GLEngine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL is not available in this browser');
    this.gl = gl;
    this.width = 0;
    this.height = 0;
    this.view = matIdentity();
    this.proj = matIdentity();

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error('shader compile failed: ' + gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    this.u = {
      model: gl.getUniformLocation(prog, 'uModel'),
      view: gl.getUniformLocation(prog, 'uView'),
      proj: gl.getUniformLocation(prog, 'uProj'),
      color: gl.getUniformLocation(prog, 'uColor'),
      lightDir: gl.getUniformLocation(prog, 'uLightDir'),
      fogColor: gl.getUniformLocation(prog, 'uFogColor'),
      fogNear: gl.getUniformLocation(prog, 'uFogNear'),
      fogFar: gl.getUniformLocation(prog, 'uFogFar'),
      ambient: gl.getUniformLocation(prog, 'uAmbient'),
      sun: gl.getUniformLocation(prog, 'uSun'),
    };
    const aPos = gl.getAttribLocation(prog, 'aPos');
    const aNormal = gl.getAttribLocation(prog, 'aNormal');
    const cube = buildCube();
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cube.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    const norBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, norBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cube.nor, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.idx, gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(PALETTE.sky[0], PALETTE.sky[1], PALETTE.sky[2], 1);
    gl.uniform3fv(this.u.lightDir, PALETTE.sunDir);
    gl.uniform3fv(this.u.fogColor, PALETTE.fog);
    gl.uniform1f(this.u.fogNear, 180);
    gl.uniform1f(this.u.fogFar, 700);
    gl.uniform1f(this.u.ambient, 0.55);
    gl.uniform1f(this.u.sun, 0.55);
  }

  resize(w, h) {
    if (this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  /** Start a frame: clear, then set the camera from eye/target/up. */
  begin(eye, target) {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.view = matLookAt(eye, target, [0, 1, 0]);
    this.proj = matPerspective((62 * Math.PI) / 180, this.width / this.height, 0.5, 900);
    gl.uniformMatrix4fv(this.u.view, false, this.view);
    gl.uniformMatrix4fv(this.u.proj, false, this.proj);
  }

  /** Draw one coloured box centred at (x, y, z), size (sx, sy, sz), rotated rotY. */
  box(x, y, z, sx, sy, sz, color, rotY) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.u.model, false, matCompose(x, y, z, rotY || 0, sx, sy, sz));
    gl.uniform3fv(this.u.color, color);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
  }

  /** Project a world point to canvas pixels; returns {x, y, visible}. */
  project(x, y, z) {
    const clip = matVec4(this.proj, matVec4(this.view, [x, y, z, 1]));
    if (clip[3] <= 0.01) return { x: 0, y: 0, visible: false };
    const nx = clip[0] / clip[3];
    const ny = clip[1] / clip[3];
    return {
      x: ((nx + 1) / 2) * this.width,
      y: ((1 - ny) / 2) * this.height,
      visible: nx > -1.05 && nx < 1.05 && ny > -1.05 && ny < 1.05,
    };
  }

  /** Camera forward direction from the current view matrix. */
  forward() {
    // The view matrix's third row is the camera's -forward in world space.
    return [-this.view[2], -this.view[6], -this.view[10]];
  }
}
