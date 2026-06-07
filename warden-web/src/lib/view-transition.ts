// Plan item 2.4 — View Transitions for drawer / tab / detail swaps.
//
// Progressive enhancement: when the browser supports the View Transitions
// API we wrap the DOM-mutating callback in `document.startViewTransition`,
// which lets the browser crossfade (or run named `view-transition-name`
// animations) between the old and new states. Everywhere else — older
// browsers, SSR — we simply run the update synchronously so behaviour is
// identical, just without the transition.
//
// Reduced-motion: the View Transitions spec already honours
// `prefers-reduced-motion` (the UA skips/cuts its animation), and any
// custom `::view-transition-*` animations we author live in globals.css
// where they're disabled under `prefers-reduced-motion: reduce`. So this
// helper is safe to call unconditionally.

// Minimal structural type so we don't depend on the lib.dom typings shipping
// `startViewTransition` (it's still relatively new). We only touch what we use.
type ViewTransitionLike = { finished?: Promise<unknown> };
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

/**
 * Run a state/DOM update inside a view transition when supported.
 *
 * @param update - Callback that performs the DOM/state mutation (e.g. a React
 *   `setState`, a router push, or a flush of pending changes). It is always
 *   invoked exactly once.
 *
 * @example
 * runViewTransition(() => setActiveTab(next));
 */
export function runViewTransition(update: () => void): void {
  // SSR-safe: `document` is undefined on the server.
  if (typeof document === "undefined") {
    update();
    return;
  }

  const doc = document as DocumentWithViewTransition;

  if (typeof doc.startViewTransition !== "function") {
    update();
    return;
  }

  doc.startViewTransition(update);
}
