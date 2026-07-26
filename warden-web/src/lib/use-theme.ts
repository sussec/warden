"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "_theme_v2";

function applyTheme(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  // Theme-color meta for mobile chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark ? "#000000" : "#f7f3ee");
}

/** Dark/light toggle — light = warm paper white × red; dark = matte black × red. */
export function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    const isDark = stored ? stored === "dark" : true;
    // localStorage/document unavailable during SSR; avoid hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  /** Set absolute theme from switch checked=true → dark. */
  const setDarkMode = useCallback((isDark: boolean) => {
    setDark(isDark);
    applyTheme(isDark);
    localStorage.setItem(KEY, isDark ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      applyTheme(next);
      localStorage.setItem(KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return { dark, toggle, setDarkMode };
}
