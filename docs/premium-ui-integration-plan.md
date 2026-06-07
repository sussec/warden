# Warden — Premium UI Integration Plan

Mined `~/Desktop/projects` (106 vanilla HTML/CSS/JS demos) for premium effects to
port into **warden-web** (Next.js 16, React 19, Tailwind v4, shadcn/radix,
light+dark themes). 6 explore agents analyzed each; below is the curated,
prioritized, workflow-ready build list — only the **keepers** that are premium
*and professional* for a security product (games / 3D novelties / playful
toggles were rejected).

## Non-negotiable constraints (apply to EVERY task)
- **Theme-safe:** use existing CSS-var tokens (`--card`, `--border`, `--primary`,
  `--muted-foreground`, `--severity-*`). Must look right in **both** light + dark.
- **Subtle > loud:** this is an ASPM dashboard. Effects accent, never distract.
- **No new heavy deps** except isolated to the login page. Prefer pure CSS +
  `pointermove → CSS custom property`. No jQuery/Bootstrap/Paper.js/VanillaTilt.
- **Respect `prefers-reduced-motion`** — disable non-essential animation.
- Each port = a **reusable component** (e.g. `GlowCard`, `CountUp`), not inline.
- Verify `bun run build` + `bun run lint` green per task.

---

## TIER 1 — High impact, low effort, ships first

### 1.1 `CountUp` KPI animation
- **Source:** animatedNumberSpinner + PlanetPicker `animate.fromTo` (cosine ease).
- **Target:** dashboard KPI cards (`dashboard-ui.tsx` `KpiCard` value), finding counts.
- **Build:** `useCountUp(target, 600ms)` hook (rAF, ease-out), `requestAnimationFrame`-driven; respects reduced-motion (snaps to value).
- **Effort:** Easy. Pure JS hook.

### 1.2 `GlowButton` primary CTA
- **Source:** hoverGlowButton (box-shadow glow + icon slide) — restrained.
- **Target:** primary buttons (`button.tsx` variant `glow` or default hover).
- **Build:** hover → `box-shadow: 0 0 0 1px primary, 0 8px 24px -8px primary/40` + subtle icon translate. Token-driven.
- **Effort:** Easy. CSS only.

### 1.3 `StatusGlow` live indicators
- **Source:** socialMediaGlowing (multi-layer box/text-shadow, gentle pulse).
- **Target:** dashboard "LIVE" pill, scanner running badges, severity dots.
- **Build:** soft pulsing `box-shadow` keyed to a color token; reduced-motion → static.
- **Effort:** Easy.

### 1.4 Border-accent on cards
- **Source:** borderAnimationOnHover (corner borders grow on hover).
- **Target:** KPI cards / panels (`Panel`, `KpiCard`).
- **Build:** `::before/::after` thin borders width/height 0→100% staggered on hover, `--primary` tint.
- **Effort:** Easy. CSS only.

### 1.5 404 / error page
- **Source:** error404Animation (flicker + multi-layer text-shadow neon).
- **Target:** `app/error/*`, not-found page.
- **Build:** keyframe flicker on the code; tone glow to `--primary` (not red). Keep tasteful.
- **Effort:** Easy.

---

## TIER 2 — Signature interactions (medium effort, high polish)

### 2.1 `GlowCard` proximity glow  ⭐ signature
- **Source:** proximityGlowCards (pointer angle → conic-gradient border glow) +
  cardHoverEffect (radial mask reveal).
- **Target:** dashboard KPI tiles + panels; optional finding-row hover (lighter variant).
- **Build:** wrapper attaches `pointermove` → sets `--x/--y` (and `--start` angle);
  `::before` conic/radial gradient masked to border. Two variants: `glow` (KPI) and
  `track` (row, radial spotlight following cursor). Token colors; reduced-motion off.
- **Effort:** Medium (mask-composite needs arbitrary CSS, not just Tailwind utils).
- **Note:** the standout effect — makes the dashboard feel alive without noise.

### 2.2 `ElasticToggle` (theme switch + feature switches)
- **Source:** stretchableElasticToggleCss (spring `linear()` easing, thumb stretch).
- **Target:** topbar light/dark toggle, settings switches.
- **Build:** wrap radix Switch; apply spring `linear(...)` easing + thumb stretch keyframe. Fallback ease for old browsers.
- **Effort:** Medium.

### 2.3 Glass treatment — sidebar + modals
- **Source:** glassEffectSidebar (`backdrop-filter: blur(15px)` + translucency) +
  glassmorphismCreditCard (frosted card + animated underline inputs).
- **Target:** app `Sidebar` background, Sheet/Dialog surfaces, auth card.
- **Build:** add `backdrop-blur` + `bg-sidebar/70` (light) / translucent dark; keep radix
  structure (do NOT import Popper). Animated underline on inputs (focus → slide).
- **Effort:** Medium. Verify legibility over content in both themes.

### 2.4 View Transitions for drawer / tab / detail swaps
- **Source:** galleryWithViewTransitions (`document.startViewTransition()`).
- **Target:** dashboard tab switch (Overview↔Findings), finding list→detail, AI dock open.
- **Build:** wrap navigations/state-swaps in `startViewTransition` w/ `view-transition-name`; progressive-enhancement (no-op where unsupported).
- **Effort:** Easy-Medium.

---

## TIER 3 — Login / auth glow-up (isolated; heavier deps allowed here only)

### 3.1 Login ambient background  ⭐
- **Source (prime):** neuroNoiseglslShader (raw WebGL, ~200-line GLSL, **very low GPU**, organic/scientific, non-interactive).
- **Fallback:** bokehBackground (three.js CDN, ~300KB) or abstractLoginPage (pure CSS shapes) for a no-WebGL path.
- **Target:** login page background, behind a frosted auth card.
- **Build:** isolated client component (`<LoginBackdrop>`), lazy-loaded, dark overlay
  `opacity .5` for text legibility, `prefers-reduced-motion` → static gradient.
- **Effort:** Medium-Hard (WebGL lifecycle). Isolated to /login so bundle impact contained.

### 3.2 Frosted auth card + squircle CTA
- **Source:** glassmorphicSignInForm10 (frosted card) + GlassmorphicModern (squircle button glow + SVG grid) + logInSignUp (slide between login/forgot/MFA).
- **Target:** login/auth forms.
- **Build:** glass card over 3.1; squircle primary button with under-glow; optional
  slide transition between auth steps (pure CSS state machine, no jQuery).
- **Effort:** Medium.

---

## Rejected (do NOT port — tone/perf/dep mismatch)
particle repulsion (ParticleS), pointer-particle web component, darkPlanet 3D,
webglLiquidMasking, droppyWoppyInput (three+cannon+gsap), fireflyButton (Kinet.js),
animatedButton (over-flashy), toiletPaperRollToggle, circleMenu / toggledRadial /
mobileMenuCssOnly 3D tilt, productCardParallaxTilt, interactiveUiCards carousel,
404Room 3D, music-player dashboard, landingPage audio rings.

---

## Suggested workflow shape (for `/workflow`)
Pipeline, ~13 component tasks, mostly independent → high parallelism:

1. **Phase 1 — Foundations (parallel):** CountUp hook, GlowButton, StatusGlow,
   Border-accent, 404 page  (Tier 1). Each: build component + wire one usage + build/lint.
2. **Phase 2 — Signatures (parallel):** GlowCard, ElasticToggle, Glass treatment,
   View Transitions  (Tier 2). Worktree isolation per task (they touch shared files:
   `dashboard-ui.tsx`, `button.tsx`, `sidebar.tsx` — serialize those or isolate).
3. **Phase 3 — Login (sequential-ish):** LoginBackdrop → frosted auth card → squircle CTA.
4. **Phase 4 — Review gate:** a reviewer agent checks every task against the
   constraints above (theme-safe both modes, reduced-motion, no heavy deps leaking
   out of /login, build+lint green), then one integration build + visual checklist.

**Shared brief for every implementer agent:** the "Non-negotiable constraints"
section above + "match the existing premium dashboard style (`dashboard-ui.tsx`)."

> Deploy after each phase via `docker compose build web && docker compose up -d web`
> (API unchanged). Verify at `localhost:8080`.

---

## TIER 4 — Animate EVERYTHING (dashboard + all pages, bold but tasteful)

Strategy: animate the **shared primitives** so all ~30 routes inherit motion
(no per-page edits), plus bolder dashboard motion. All reduced-motion safe.

**Motion foundation (globals.css):** `@keyframes warden-rise` (opacity+translateY),
`warden-fade`; `.warden-reveal` (runs once, `animation-delay: calc(var(--reveal-i,0)*60ms)`
for stagger); guarded by prefers-reduced-motion.

**New components:** `Reveal`/`Stagger` (IntersectionObserver mount/scroll reveal),
`PageTransition` (re-keys + animates children on pathname change).

**Wire shared primitives (high leverage — touches every page):**
- `ui/card.tsx` → subtle mount rise-in (8px, ~400ms) → cards everywhere animate in.
- `data-table.tsx` → staggered row reveal (finding/project/dependency lists).
- `ui/table.tsx` → row fade-in.
- `charts/donut-chart.tsx` + `hbar-chart.tsx` → enable chart.js mount animation (grow/sweep).
- `(app)/layout.tsx` → wrap children in `PageTransition` (route-change fade/slide).

**Bolder dashboard:** recharts `isAnimationActive` on TrendArea + donut (draw-in on load),
KPI strip staggered reveal, bump glow + animated rotating gradient-border on the two hero
panels (cardsgradientBorder technique), count-up already live.
