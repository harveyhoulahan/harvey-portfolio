/*
 * viewer.ts — hand-rolled WebGL2 Gaussian-splat renderer for the About-page
 * portrait. No three.js, no splat library: one instanced quad per gaussian,
 * covariance projected to a screen-space ellipse in the vertex shader, drawn
 * back-to-front with premultiplied alpha. Depth ordering runs in a Worker
 * (counting sort from lib/splat/parse.ts, embedded via toString so the two
 * never diverge). WebGL2 rather than WebGPU on purpose: the About page must
 * work on phones, where the flagship WebGPU demos can't.
 *
 * Splat data comes from ml/splat/build_splat.py — subject centred at origin,
 * up = +Y — so the camera is a plain orbit around the origin.
 */

import { perspectiveZO, lookAt, type Vec3 } from "@/lib/catchment/mat4";
import { parseSplat, sortByDepth, type SplatData } from "@/lib/splat/parse";

const TEX_W = 4096; // data-texture width in texels; 4 texels per splat

const VS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

layout(location = 0) in vec2 corner;   // quad, ±2 (σ units)
layout(location = 1) in uint iIndex;   // per-instance splat id, depth-sorted

uniform sampler2D uData;    // 4 RGBA32F texels per splat
uniform mat4 uView;
uniform mat4 uProj;
uniform vec2 uFocal;        // fx, fy in pixels
uniform vec2 uViewport;     // px

out vec2 vPos;   // σ units
out vec4 vColor; // premultiplied later in fs

vec4 fetchTexel(uint i, uint k) {
  uint t = i * 4u + k;
  return texelFetch(uData, ivec2(int(t % ${TEX_W}u), int(t / ${TEX_W}u)), 0);
}

void main() {
  vec4 t0 = fetchTexel(iIndex, 0u); // xyz, opacity
  vec4 cam = uView * vec4(t0.xyz, 1.0);
  // behind the camera → degenerate triangle
  if (cam.z > -0.05) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }

  vec4 t1 = fetchTexel(iIndex, 1u); // cov xx xy xz yy
  vec4 t2 = fetchTexel(iIndex, 2u); // cov yz zz, colour rg
  vec4 t3 = fetchTexel(iIndex, 3u); // colour b

  // Project the 3D covariance to screen space: Σ' = J W Σ Wᵀ Jᵀ
  mat3 Vrk = mat3(
    t1.x, t1.y, t1.z,
    t1.y, t1.w, t2.x,
    t1.z, t2.x, t2.y
  );
  float invZ = 1.0 / cam.z;
  mat3 J = mat3(
    uFocal.x * invZ, 0.0, 0.0,
    0.0, uFocal.y * invZ, 0.0,
    -uFocal.x * cam.x * invZ * invZ, -uFocal.y * cam.y * invZ * invZ, 0.0
  );
  mat3 W = transpose(mat3(uView));
  mat3 T = W * Vrk * transpose(W);
  mat3 covScreen = transpose(J) * T * J;

  float a = covScreen[0][0] + 0.3; // low-pass: ≥ ~0.5px footprint
  float d = covScreen[1][1] + 0.3;
  float b = covScreen[0][1];
  float mid = 0.5 * (a + d);
  float disc = sqrt(max(0.0, mid * mid - (a * d - b * b)));
  float l1 = mid + disc;
  float l2 = max(mid - disc, 0.05);
  if (l1 > 16384.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; } // degenerate blowups

  vec2 major = normalize(abs(b) > 1e-6 ? vec2(b, l1 - a) : vec2(1.0, 0.0));
  vec2 minor = vec2(-major.y, major.x);
  vec2 axis1 = major * sqrt(l1); // px per σ
  vec2 axis2 = minor * sqrt(l2);

  vec4 center = uProj * cam;
  vec2 offsetPx = corner.x * axis1 + corner.y * axis2;
  center.xy += offsetPx * 2.0 / uViewport * center.w;

  gl_Position = center;
  vPos = corner;
  vColor = vec4(t2.z, t2.w, t3.x, t0.w);
}
`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPos;
in vec4 vColor;
out vec4 outColor;
void main() {
  float r2 = dot(vPos, vPos);
  if (r2 > 4.0) discard;                 // beyond 2σ
  float alpha = vColor.a * exp(-0.5 * r2 * 2.0);
  outColor = vec4(vColor.rgb * alpha, alpha); // premultiplied
}
`;

/** Worker source: the sort function is embedded from parse.ts so the math has
 *  exactly one home. It only uses its own arguments — safe to stringify. */
function makeSortWorker(): Worker {
  const src = `
"use strict";
const sortByDepth = ${sortByDepth.toString()};
let positions = null, count = 0;
onmessage = (e) => {
  const m = e.data;
  if (m.positions) { positions = new Float32Array(m.positions); count = m.count; return; }
  if (!positions) return;
  const order = sortByDepth(positions, count, m.f[0], m.f[1], m.f[2]);
  postMessage({ order: order.buffer, gen: m.gen }, [order.buffer]);
};
`;
  const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
  const w = new Worker(url);
  URL.revokeObjectURL(url);
  return w;
}

export interface ViewerOptions {
  /** background clear colour, premultiplied-over target (default transparent) */
  autoRotate?: boolean;
  fovYDeg?: number;
  minRadius?: number;
  maxRadius?: number;
}

export class SplatViewer {
  readonly count: number;
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program!: WebGLProgram;
  private indexBuf!: WebGLBuffer;
  private vao!: WebGLVertexArrayObject;
  private dataTex!: WebGLTexture;
  private uni: Record<string, WebGLUniformLocation | null> = {};
  private worker: Worker;
  private data: SplatData;

  // orbit state
  private yaw = Math.PI * 0.15;
  private pitch = 0.08;
  private radius = 2.6;
  private targetY = 0;
  private autoRotate: boolean;
  private fovY: number;
  private minR: number;
  private maxR: number;

  private raf = 0;
  private running = false;
  private disposed = false;
  private sortGen = 0;
  private lastSortDir: Vec3 = [0, 0, 0];
  private sortInFlight = false;
  private haveOrder = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastPinch = 0;
  private interacted = false;
  private onInteract: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, buf: ArrayBuffer, opts: ViewerOptions = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true, antialias: false, depth: false, premultipliedAlpha: true,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.data = parseSplat(buf);
    this.count = this.data.count;
    this.autoRotate = opts.autoRotate ?? true;
    this.fovY = ((opts.fovYDeg ?? 42) * Math.PI) / 180;
    this.minR = opts.minRadius ?? 1.4;
    this.maxR = opts.maxRadius ?? 4.5;

    this.initGL();
    this.worker = makeSortWorker();
    const posCopy = this.data.positions.slice();
    this.worker.postMessage({ positions: posCopy.buffer, count: this.count }, [posCopy.buffer]);
    this.worker.onmessage = (e) => {
      const order = new Uint32Array(e.data.order);
      const glb = this.gl;
      glb.bindBuffer(glb.ARRAY_BUFFER, this.indexBuf);
      glb.bufferData(glb.ARRAY_BUFFER, order, glb.DYNAMIC_DRAW);
      this.sortInFlight = false;
      this.haveOrder = true;
    };

    this.bindInput();
  }

  /** first user interaction (used by the host to retire hints) */
  setInteractionCallback(cb: () => void): void { this.onInteract = cb; }

  private initGL(): void {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
    }
    this.program = prog;
    for (const name of ["uData", "uView", "uProj", "uFocal", "uViewport"]) {
      this.uni[name] = gl.getUniformLocation(prog, name);
    }

    // data texture: 4 RGBA32F texels per splat
    const { count, positions, cov, colors } = this.data;
    const texels = count * 4;
    const rows = Math.ceil(texels / TEX_W);
    const tex = new Float32Array(TEX_W * rows * 4);
    for (let i = 0; i < count; i++) {
      const o = i * 16;
      tex[o] = positions[3 * i];
      tex[o + 1] = positions[3 * i + 1];
      tex[o + 2] = positions[3 * i + 2];
      tex[o + 3] = colors[4 * i + 3] / 255;
      tex[o + 4] = cov[6 * i];
      tex[o + 5] = cov[6 * i + 1];
      tex[o + 6] = cov[6 * i + 2];
      tex[o + 7] = cov[6 * i + 3];
      tex[o + 8] = cov[6 * i + 4];
      tex[o + 9] = cov[6 * i + 5];
      tex[o + 10] = colors[4 * i] / 255;
      tex[o + 11] = colors[4 * i + 1] / 255;
      tex[o + 12] = colors[4 * i + 2] / 255;
      // o+13..15 unused
    }
    this.dataTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEX_W, rows, 0, gl.RGBA, gl.FLOAT, tex);

    // geometry: one quad, instanced; per-instance sorted splat index
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.indexBuf = gl.createBuffer()!;
    const identity = new Uint32Array(count);
    for (let i = 0; i < count; i++) identity[i] = i;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, identity, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
      if (!this.interacted) { this.interacted = true; this.onInteract?.(); }
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.yaw += dx * 0.008;
      this.pitch = Math.min(0.9, Math.max(-0.5, this.pitch + dy * 0.006));
    });
    const end = () => { this.dragging = false; };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.radius = Math.min(this.maxR, Math.max(this.minR, this.radius * (1 + e.deltaY * 0.0012)));
    }, { passive: false });
    // pinch zoom
    c.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        this.lastPinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    }, { passive: true });
    c.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && this.lastPinch > 0) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        this.radius = Math.min(this.maxR, Math.max(this.minR, this.radius * (this.lastPinch / d)));
        this.lastPinch = d;
        e.preventDefault();
      }
    }, { passive: false });
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.worker.terminate();
    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }

  private frame(): void {
    const gl = this.gl;
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.floor(c.clientWidth * dpr));
    const h = Math.max(2, Math.floor(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }

    if (this.autoRotate && !this.dragging) this.yaw += 0.0028;

    const eye: Vec3 = [
      Math.cos(this.pitch) * Math.sin(this.yaw) * this.radius,
      this.targetY + Math.sin(this.pitch) * this.radius,
      Math.cos(this.pitch) * Math.cos(this.yaw) * this.radius,
    ];
    const target: Vec3 = [0, this.targetY, 0];
    const view = lookAt(eye, target, [0, 1, 0]);
    const proj = perspectiveZO(this.fovY, w / h, 0.05, 100);
    const fy = h / (2 * Math.tan(this.fovY / 2));

    // re-sort when the view direction has moved enough (worker, non-blocking)
    const f: Vec3 = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(...f) || 1;
    f[0] /= fl; f[1] /= fl; f[2] /= fl;
    const dot = f[0] * this.lastSortDir[0] + f[1] * this.lastSortDir[1] + f[2] * this.lastSortDir[2];
    if (!this.sortInFlight && (dot < 0.9995 || !this.haveOrder)) {
      this.sortInFlight = true;
      this.lastSortDir = [...f] as Vec3;
      this.sortGen++;
      this.worker.postMessage({ f, gen: this.sortGen });
    }

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.haveOrder) return; // first sort still in flight

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
    gl.uniform1i(this.uni.uData, 0);
    gl.uniformMatrix4fv(this.uni.uView, false, view);
    gl.uniformMatrix4fv(this.uni.uProj, false, proj);
    gl.uniform2f(this.uni.uFocal, fy, fy);
    gl.uniform2f(this.uni.uViewport, w, h);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }
}

/** Convenience loader: fetch + construct, or null if the asset isn't there. */
export async function loadSplatViewer(
  canvas: HTMLCanvasElement, url: string, opts?: ViewerOptions,
): Promise<SplatViewer | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return new SplatViewer(canvas, buf, opts);
}
