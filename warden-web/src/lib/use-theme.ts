"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "_theme_v2";

/**
 * Reflect the active theme everywhere it's needed:
 * - `.dark` class for any legacy `dark:` variants,
 * - Kumo's `data-mode` (light/dark) — Kumo tokens switch on this,
 * - `color-scheme` so Kumo's `light-dark()` text tokens resolve correctly.
 */
function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  const mode = isDark ? "dark" : "light";
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-mode", mode);
  root.style.colorScheme = mode;
}

/** Dark-mode toggle persisted under the same key as the Angular app. */
export function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      applyTheme(next);
      localStorage.setItem(KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return { dark, toggle };
}
