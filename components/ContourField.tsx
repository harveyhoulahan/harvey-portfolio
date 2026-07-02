"use client";

/*
 * Signature element: a live topographic contour field, hand-written GLSL.
 *
 * An fBm heightfield drifts slowly; it is rendered purely as survey-sheet
 * contour lines (minor + major intervals) with a faint teal pooling wash in
 * the valleys. The cursor applies a local uplift, so the contours bend around
 * it the way a DEM responds to terrain. On load the contours draw on from the
 * valleys upward, like a plotter filling in a sheet.
 *
 * Zero dependencies — one fragment shader on a fullscreen triangle, WebGL1 +
 * OES_standard_derivatives. Honors prefers-reduced-motion (single static
 * frame, no pointer response), pauses when off-screen or the tab is hidden,
 * and renders nothing at all if WebGL is unavailable (the paper background
 * stands alone). Used on the homepage hero only — never on the demo routes,
 * which own the GPU.
 */

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mstr;
uniform float u_reveal;
uniform vec4 u_rip0;
uniform vec4 u_rip1;
uniform vec4 u_rip2;
uniform vec4 u_rip3;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}

// Rain drop: an expanding, decaying ring in the heightfield.
float ripple(vec2 uv, vec4 rip) {
  if (rip.w < 0.5) return 0.0;
  vec2 p = rip.xy / u_res.y;
  float age = rip.z;
  float d = distance(uv, p);
  float r = 0.16 * age;
  float envelope = exp(-age * 1.15) * exp(-pow(d - r, 2.0) * 900.0);
  return 0.05 * envelope * sin(46.0 * (d - r));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.y;
  float t = u_time * 0.016;
  float h = fbm(uv * 2.4 + vec2(t, -t * 0.6));

  // Cursor uplift: a smooth local bump the contours bend around.
  vec2 m = u_mouse / u_res.y;
  float d = distance(uv, m);
  float bump = exp(-d * d * 26.0);
  h += u_mstr * 0.16 * bump;

  // Click-to-rain: droplets propagate through the field.
  h += ripple(uv, u_rip0) + ripple(uv, u_rip1) + ripple(uv, u_rip2) + ripple(uv, u_rip3);

  // Minor contours every level, major every fifth.
  float levels = 24.0;
  float hl = h * levels;
  float f = abs(fract(hl) - 0.5);
  float w = fwidth(hl);
  float line = 1.0 - smoothstep(0.5 * w, 1.6 * w, f);

  float hl5 = hl / 5.0;
  float f5 = abs(fract(hl5) - 0.5);
  float w5 = fwidth(hl5);
  float major = 1.0 - smoothstep(0.5 * w5, 1.8 * w5, f5);

  // Contours draw on from the valleys upward on load.
  float vis = smoothstep(h - 0.06, h, u_reveal * 1.1);

  vec3 ink = vec3(0.086, 0.122, 0.106);
  vec3 flow = vec3(0.078, 0.396, 0.353);
  vec3 infra = vec3(0.698, 0.227, 0.094);
  float prox = clamp(bump * u_mstr * 1.6, 0.0, 1.0);
  vec3 col = mix(ink, flow, prox);

  // CIR signal: ridgelines flush vegetation-red, like canopy in false colour.
  float ridge = smoothstep(0.64, 0.80, h);
  col = mix(col, infra, ridge * 0.45);

  float alpha = (line * 0.085 + major * 0.075) * vis;
  alpha += prox * line * 0.10;
  alpha += ridge * line * 0.05 * vis;

  // Hillshade: sun from the NW, shadow washed in as faint ink.
  vec2 g = vec2(dFdx(h), dFdy(h));
  vec3 n = normalize(vec3(-g * 220.0, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
  float lambert = clamp(dot(n, L), 0.0, 1.0);
  float shade = clamp(0.52 - lambert, 0.0, 1.0);
  alpha += shade * 0.16 * vis;

  // Faint teal pooling in the valleys: water finding the channels.
  float pool = smoothstep(0.40, 0.24, h);
  col = mix(col, flow, pool * 0.6);
  alpha += pool * 0.05 * vis;

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export default function ContourField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    }) as WebGLRenderingContext | null;
    if (!gl || !gl.getExtension("OES_standard_derivatives")) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // Fullscreen triangle.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uMstr = gl.getUniformLocation(prog, "u_mstr");
    const uReveal = gl.getUniformLocation(prog, "u_reveal");
    const uRips = [0, 1, 2, 3].map((i) =>
      gl.getUniformLocation(prog, `u_rip${i}`)
    );

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let reduced = reducedMq.matches;

    let raf = 0;
    let running = false;
    let visible = !document.hidden;
    let inView = true;
    const start = performance.now();
    let mouse: [number, number] = [-1e4, -1e4];
    let mstr = 0;
    let target = 0;
    // Up to four live raindrops: canvas-space x, y and birth timestamp.
    const ripples: { x: number; y: number; born: number }[] = [];
    // Recent click times — three quick clicks summon a storm.
    const clicks: number[] = [];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (now: number) => {
      resize();
      const t = (now - start) / 1000;
      const reveal = reduced ? 1 : Math.min(1, t / 1.4);
      const eased = 1 - Math.pow(1 - reveal, 3);
      mstr += (target - mstr) * 0.06;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 0 : t);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.uniform1f(uMstr, mstr);
      gl.uniform1f(uReveal, eased);
      for (let i = 0; i < 4; i++) {
        const rip = ripples[i];
        const age = rip ? (now - rip.born) / 1000 : 99;
        // age < 0 means a storm drop scheduled just ahead — not landed yet.
        if (rip && age >= 0 && age < 3.5)
          gl.uniform4f(uRips[i], rip.x, rip.y, age, 1);
        else gl.uniform4f(uRips[i], 0, 0, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      draw(now);
      if (running) raf = requestAnimationFrame(loop);
    };
    const setRunning = () => {
      const should = !reduced && visible && inView;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const scale = canvas.width / Math.max(1, r.width);
      mouse = [
        (e.clientX - r.left) * scale,
        canvas.height - (e.clientY - r.top) * scale,
      ];
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      target = inside ? 1 : 0;
    };
    if (finePointer && !reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }

    // Click / tap anywhere over the hero drops rain into the field.
    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      const r = canvas.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        return;
      const scale = canvas.width / Math.max(1, r.width);
      const px = (e.clientX - r.left) * scale;
      const py = canvas.height - (e.clientY - r.top) * scale;
      const nowT = performance.now();
      if (ripples.length >= 4) ripples.shift();
      ripples.push({ x: px, y: py, born: nowT });

      // Easter egg: three clicks inside 700ms and the whole sheet gets rain —
      // a staggered salvo of drops spread around the last strike.
      clicks.push(nowT);
      while (clicks.length && nowT - clicks[0] > 700) clicks.shift();
      if (clicks.length >= 3) {
        clicks.length = 0;
        ripples.length = 0;
        const spread: [number, number][] = [
          [-0.28, 0.16],
          [0.26, -0.12],
          [-0.08, -0.3],
          [0.32, 0.24],
        ];
        spread.forEach(([ox, oy], i) =>
          ripples.push({
            x: px + ox * canvas.width,
            y: py + oy * canvas.height,
            born: nowT + i * 130,
          })
        );
      }
    };
    window.addEventListener("pointerdown", onDown, { passive: true });

    const onVis = () => {
      visible = !document.hidden;
      setRunning();
    };
    document.addEventListener("visibilitychange", onVis);

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      setRunning();
    });
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      if (!running) draw(performance.now());
    });
    ro.observe(canvas);

    const onReduced = () => {
      reduced = reducedMq.matches;
      if (reduced) {
        target = 0;
        mstr = 0;
        setRunning();
        draw(performance.now());
      } else {
        setRunning();
      }
    };
    reducedMq.addEventListener("change", onReduced);

    if (reduced) draw(performance.now());
    else setRunning();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVis);
      reducedMq.removeEventListener("change", onReduced);
      io.disconnect();
      ro.disconnect();
      // Note: no loseContext() here — React StrictMode remounts reuse the same
      // canvas, and getContext() would hand back the deliberately-killed context.
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
