"use client";

/**
 * LoginBackdrop — an isolated, ambient WebGL background for the auth screens.
 *
 * Ported from a raw-WebGL GLSL "neuro-noise" shader
 * (https://codepen.io/ksenia-k/pen/vYwgrWv — Ksenia Kondrashova / @zozuar artwork),
 * re-toned to be dark, subtle, and theme-safe for a security dashboard.
 *
 * Design notes:
 *  - Raw WebGL only, NO three.js / external libs.
 *  - Very low GPU: single full-screen triangle strip, mediump, a handful of uniforms.
 *  - Non-interactive: the "pointer" is parked at center so the field drifts gently
 *    rather than reacting to the cursor (accent, never distract).
 *  - Theme-safe: the accent colour is sampled at runtime from the `--primary`
 *    CSS token (with `--card` as the base tint) so it reads correctly in BOTH
 *    light and dark themes — never a hardcoded hex.
 *  - Honours `prefers-reduced-motion` and the no-WebGL path by rendering a
 *    static, token-driven gradient instead.
 *  - Cleans up the GL context + rAF + listeners on unmount.
 */

import { useEffect, useRef, useState } from "react";

const VERT_SRC = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  attribute vec2 a_position;
  void main() {
    vUv = 0.5 * (a_position + 1.0);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Toned-down port of the original neuro_shape field. The intensity curve is
// pulled back (lower exponents / amplitude) and the colour is supplied as a
// uniform sampled from the active theme so it never fights the palette.
const FRAG_SRC = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  uniform float u_time;
  uniform float u_ratio;
  uniform vec2 u_pointer_position;
  uniform vec3 u_accent;
  uniform float u_intensity;

  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }

  float neuro_shape(vec2 uv, float t, float p) {
    vec2 sine_acc = vec2(0.0);
    vec2 res = vec2(0.0);
    float scale = 8.0;

    for (int j = 0; j < 12; j++) {
      uv = rotate(uv, 1.0);
      sine_acc = rotate(sine_acc, 1.0);
      vec2 layer = uv * scale + float(j) + sine_acc - t;
      sine_acc += sin(layer);
      res += (0.5 + 0.5 * cos(layer)) / scale;
      scale *= (1.2 - 0.07 * p);
    }
    return res.x + res.y;
  }

  void main() {
    vec2 uv = 0.5 * vUv;
    uv.x *= u_ratio;

    vec2 pointer = vUv - u_pointer_position;
    pointer.x *= u_ratio;
    float p = clamp(length(pointer), 0.0, 1.0);
    p = 0.5 * pow(1.0 - p, 2.0);

    float t = 0.001 * u_time;

    float noise = neuro_shape(uv, t, p);

    // Softer response than the original: smaller exponents + lower gain so the
    // filaments stay as a faint texture rather than bright neon strokes.
    noise = 1.2 * pow(noise, 3.0);
    noise += pow(noise, 8.0);
    noise = max(0.0, noise - 0.6);

    // Vignette so the edges fade into the page background.
    noise *= (1.0 - length(vUv - 0.5));
    noise *= u_intensity;

    vec3 color = u_accent * noise;
    gl_FragColor = vec4(color, noise);
  }
`;

/**
 * Resolve a CSS colour token (which may be `oklch(...)`, `hsl(...)`, hex, etc.)
 * to a normalized [r, g, b] triple in 0..1 by letting the browser do the
 * conversion via a throwaway 2D canvas. Returns null if it can't be resolved.
 */
function resolveColor(value: string): [number, number, number] | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillStyle = value; // browser parses oklch/hsl/etc.; ignored if invalid
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** Read the live `--primary` (with `--card` fallback) accent from an element. */
function readAccent(el: Element): [number, number, number] {
  const styles = getComputedStyle(el);
  const primary = resolveColor(styles.getPropertyValue("--primary").trim());
  if (primary) return primary;
  const card = resolveColor(styles.getPropertyValue("--card").trim());
  if (card) return card;
  // Sensible blue accent if tokens are somehow unavailable.
  return [0.36, 0.5, 0.95];
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface LoginBackdropProps {
  /** Extra classes for the fixed wrapper. */
  className?: string;
  /**
   * Overall strength of the effect (0..1-ish). Kept low by default so the
   * field stays a quiet accent behind the auth card.
   */
  intensity?: number;
}

export function LoginBackdrop({ className, intensity = 0.55 }: LoginBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Start in the static-fallback state; the effect flips it off only once a GL
  // context is live and motion is allowed. This guarantees SSR + no-JS shows
  // the gradient and we never flash an empty canvas.
  const [useFallback, setUseFallback] = useState(true);

  useEffect(() => {
    // `useFallback` already starts true, so the reduced-motion path just bails —
    // the static gradient stays up without a redundant synchronous setState.
    if (prefersReducedMotion()) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true }) as
        | WebGLRenderingContext
        | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      setUseFallback(true);
      return;
    }

    // --- compile + link -----------------------------------------------------
    const compile = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setUseFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setUseFallback(true);
      return;
    }
    gl.useProgram(program);

    // --- geometry: one full-screen triangle strip ---------------------------
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Premultiplied-alpha blend so the canvas composites cleanly over the page.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRatio = gl.getUniformLocation(program, "u_ratio");
    const uPointer = gl.getUniformLocation(program, "u_pointer_position");
    const uAccent = gl.getUniformLocation(program, "u_accent");
    const uIntensity = gl.getUniformLocation(program, "u_intensity");

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5);

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uRatio, canvas.width / canvas.height);
    };

    // Accent is theme-driven; re-read when the theme class/attr changes.
    const applyAccent = () => {
      const [r, g, b] = readAccent(document.documentElement);
      gl.uniform3f(uAccent, r, g, b);
    };

    gl.uniform1f(uIntensity, intensity);
    // Park the pointer at center — ambient, non-interactive drift.
    gl.uniform2f(uPointer, 0.5, 0.5);
    resize();
    applyAccent();
    setUseFallback(false);

    let raf = 0;
    const start = performance.now();
    const loop = () => {
      // Slow the clock vs. the original so motion is calm, not busy.
      gl.uniform1f(uTime, (performance.now() - start) * 0.45);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("resize", resize);

    const themeObserver = new MutationObserver(applyAccent);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    // Pause the loop when the tab is hidden to spare the GPU.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (raf === 0) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // --- teardown -----------------------------------------------------------
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // Best-effort: drop the backing context so the GPU resources are freed.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [intensity]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-sidebar ${className ?? ""}`}
    >
      {/* Static, token-driven gradient — the SSR / no-WebGL / reduced-motion path. */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: useFallback ? 1 : 0,
          background:
            "radial-gradient(120% 120% at 50% 0%, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 55%)," +
            "radial-gradient(100% 100% at 100% 100%, color-mix(in oklab, var(--primary) 8%, transparent) 0%, transparent 60%)," +
            "var(--sidebar)",
        }}
      />
      {/* Live WebGL field. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full transition-opacity duration-700"
        style={{ opacity: useFallback ? 0 : 0.7 }}
      />
      {/* Dark overlay (~0.5) so the auth card text stays legible over the field. */}
      <div className="absolute inset-0 bg-sidebar/50" />
    </div>
  );
}

export default LoginBackdrop;
