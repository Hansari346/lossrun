# Phase 1: Foundation & Build Infrastructure - Research

**Researched:** 2026-02-12
**Domain:** Vite build tooling, Preact UI framework, Cloudflare Workers SPA deployment, monolith extraction
**Confidence:** HIGH

## Summary

This phase transforms a monolithic 3,348-line Cloudflare Worker (which returns an HTML template literal) into a modular TypeScript codebase using Vite as the build system, Preact with Signals for UI and state management, and Tailwind CSS v4 for styling. The current Worker serves a single HTML page via `new Response(HTML_CONTENT)` — the new architecture uses Vite to build a proper SPA with `index.html` as the entry point, served via Cloudflare Workers Static Assets.

The migration follows a **Strangler Fig** pattern: set up the new toolchain first, extract HTML/CSS/JS from the template literal into proper source files, then incrementally introduce TypeScript and Preact components. The old `src/worker.js` stays as a reference until the new code path is validated.

**Primary recommendation:** Use `@cloudflare/vite-plugin` + `@preact/preset-vite` + `@tailwindcss/vite` as Vite plugins. Create an `index.html` at project root. Configure `wrangler.jsonc` with `assets.not_found_handling: "single-page-application"` and remove the `main` field. Extract HTML/CSS/JS from the template literal into proper files, preserving all existing behavior.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | ^6.0 | Build tooling, dev server, HMR | Official Cloudflare recommendation for Workers; Vite Environment API integration |
| `@cloudflare/vite-plugin` | ^1.21 | Cloudflare Workers integration for Vite | Official plugin; auto-discovers wrangler config, builds client + worker output, handles static assets |
| `preact` | ^10.28 | UI framework (3KB) | Lightweight React-compatible alternative; project decision locked |
| `@preact/signals` | ^2.7 | Reactive state management | First-class Preact integration; replaces global mutable state with reactive signals |
| `@preact/preset-vite` | ^2.10 | Vite preset for Preact | Handles JSX transform, HMR via Prefresh, React-to-Preact aliasing, DevTools |
| `tailwindcss` | ^4.0 | Utility-first CSS | Zero-config with Vite plugin; no tailwind.config.js needed in v4 |
| `@tailwindcss/vite` | ^4.0 | Tailwind CSS Vite plugin | Direct Vite integration, no PostCSS or Autoprefixer needed |
| `typescript` | ~5.7 | Type safety | Project decision; Preact has full TS support with `jsxImportSource` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `wrangler` | ^4.64 | Cloudflare Workers CLI | Deploy, types generation, local miniflare |
| `@cloudflare/workers-types` | latest | TypeScript types for Workers runtime | Worker entry point typing (if we keep one) |
| `vitest` | ~3.2 | Test framework | Phase 1 setup only; actual tests later |
| `@cloudflare/vitest-pool-workers` | latest | Vitest pool for Workers runtime | Phase 1 setup only; runs tests in workerd |

### CDN Libraries (kept as-is for Phase 1)

| Library | Version | Purpose | Migration Phase |
|---------|---------|---------|-----------------|
| SheetJS (xlsx) | 0.18.5 | Excel parsing | Phase 2 (npm-install) |
| Chart.js | 4.4.1 | Chart rendering | Phase 4 (npm-install) |
| PptxGenJS | 3.12.0 | PowerPoint export | Phase 5 (npm-install) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Preact | React | React is 40KB+ vs Preact 3KB; Worker script size matters (PT-4) |
| @preact/signals | Zustand / Jotai | Signals are first-class in Preact; no adapter needed, automatic re-render optimization |
| Tailwind CSS v4 | v3 | v4 is zero-config with Vite plugin; no tailwind.config.js or PostCSS needed |

**Installation:**

```bash
npm install preact @preact/signals tailwindcss
npm install -D vite @cloudflare/vite-plugin @preact/preset-vite @tailwindcss/vite typescript @cloudflare/workers-types vitest@~3.2 @cloudflare/vitest-pool-workers
```

## Architecture Patterns

### Recommended Project Structure

```
lossrun/
├── index.html                    # Vite SPA entry point (extracted from template literal)
├── vite.config.ts                # Vite + Cloudflare + Preact + Tailwind plugins
├── tsconfig.json                 # Base TypeScript config (references)
├── tsconfig.app.json             # App-specific TS config (Preact JSX)
├── tsconfig.node.json            # Node/Vite TS config
├── wrangler.jsonc                # Updated: assets config, no main field
├── package.json                  # Updated: type=module, new scripts & deps
├── src/
│   ├── main.tsx                  # Preact app entry — render(<App />, root)
│   ├── app.tsx                   # Root component — wizard layout, page routing
│   ├── styles.css                # Main CSS file — @import "tailwindcss" + extracted styles
│   ├── state/
│   │   └── store.ts              # Centralized signals store (workbook, mappings, etc.)
│   ├── components/
│   │   ├── nav.tsx               # Wizard navigation bar
│   │   ├── upload-page.tsx       # Page 1: File upload & field mapping
│   │   ├── adjustments-page.tsx  # Page 2: Adjustment sliders
│   │   └── results-page.tsx      # Page 3: Results & charts
│   ├── lib/
│   │   ├── parsing.ts            # Excel parsing logic (SheetJS wrappers)
│   │   ├── calculations.ts       # Business logic (ROI, loss analysis)
│   │   ├── field-mapping.ts      # Auto-mapping / header detection
│   │   └── formatting.ts         # Number/currency formatting utilities
│   └── types/
│       └── index.ts              # Shared TypeScript interfaces
├── src/worker.js                 # KEPT AS REFERENCE — old monolith (do not delete until validated)
└── test/
    ├── tsconfig.json             # Test-specific TS config
    └── smoke.spec.ts             # Minimal smoke test (Phase 1 only)
```

### Pattern 1: SPA Without Worker Entry Point

**What:** Configure Cloudflare Workers to serve a Vite-built SPA via static assets, with no Worker `main` entry. The `assets.not_found_handling: "single-page-application"` configuration makes Cloudflare serve `index.html` for all unmatched routes.

**When to use:** When the app is purely client-side (no server-side API). This is Phase 1 — a future phase can add a Worker entry for API endpoints.

**Example:**

```jsonc
// wrangler.jsonc — Source: https://developers.cloudflare.com/workers/vite-plugin/tutorial
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "lossrun",
  "compatibility_date": "2025-12-10",
  "assets": {
    "not_found_handling": "single-page-application"
  },
  "routes": [
    {
      "pattern": "lossrun.voxelplatform.com",
      "zone_name": "voxelplatform.com",
      "custom_domain": true
    }
  ],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "persist": true,
      "invocation_logs": true
    }
  }
}
```

**Key insight:** When using the Cloudflare Vite plugin, the `assets.directory` field is NOT specified in the source `wrangler.jsonc`. The plugin auto-generates an output `wrangler.json` in `dist/` with the correct directory path pointing to the client build output. The `main` field is removed because there is no Worker entry point — the SPA is served entirely via static assets.

### Pattern 2: Vite Config with Three Plugins

**What:** Stack `@preact/preset-vite`, `@tailwindcss/vite`, and `@cloudflare/vite-plugin` in the Vite plugins array. Order matters: framework plugins first, then platform plugin.

**Example:**

```typescript
// vite.config.ts — Source: Cloudflare docs + Preact docs + Tailwind docs
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    preact(),         // JSX transform, HMR, React aliasing
    tailwindcss(),    // Tailwind CSS processing
    cloudflare(),     // Cloudflare Workers integration
  ],
});
```

### Pattern 3: Centralized Signal Store

**What:** Replace the 6 global mutable variables (`workbook`, `currentSheetName`, `headerRow`, `mappings`, `canonicalData`, `chartInstances`) with a centralized signals-based store. Business logic reads/writes to signals, never to the DOM.

**When to use:** From day one of the extraction. Even before Preact components exist, the store can hold state.

**Example:**

```typescript
// src/state/store.ts — Source: https://preactjs.com/guide/v10/signals/
import { signal, computed } from "@preact/signals";

// Replaces: let workbook = null;
export const workbook = signal<any>(null);

// Replaces: let currentSheetName = null;
export const currentSheetName = signal<string | null>(null);

// Replaces: let headerRow = [];
export const headerRow = signal<string[]>([]);

// Replaces: let mappings = {};
export const mappings = signal<Record<string, number>>({});

// Replaces: let canonicalData = [];
export const canonicalData = signal<any[]>([]);

// Replaces: let chartInstances = {};
export const chartInstances = signal<Record<string, any>>({});

// Derived state
export const hasData = computed(() => canonicalData.value.length > 0);
export const sheetNames = computed(() => {
  const wb = workbook.value;
  return wb ? wb.SheetNames || [] : [];
});

// Wizard navigation state
export const currentPage = signal<1 | 2 | 3>(1);

// Reset function
export function resetState() {
  workbook.value = null;
  currentSheetName.value = null;
  headerRow.value = [];
  mappings.value = {};
  canonicalData.value = [];
  chartInstances.value = {};
  currentPage.value = 1;
}
```

### Pattern 4: Preact Wizard Component with Signals

**What:** A multi-page wizard UI using Preact functional components with signal-driven page navigation. Each page is a separate component, shown/hidden based on a `currentPage` signal.

**Example:**

```tsx
// src/app.tsx — Source: Preact signals docs
import { currentPage } from "./state/store";
import { Nav } from "./components/nav";
import { UploadPage } from "./components/upload-page";
import { AdjustmentsPage } from "./components/adjustments-page";
import { ResultsPage } from "./components/results-page";

export function App() {
  return (
    <div class="app">
      <Nav />
      {currentPage.value === 1 && <UploadPage />}
      {currentPage.value === 2 && <AdjustmentsPage />}
      {currentPage.value === 3 && <ResultsPage />}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Reading DOM for state:** Never use `document.getElementById('someInput').value` to get application state. Always read from signals. The DOM is a render target, not a data source.
- **Direct DOM mutation from business logic:** Don't use `el('status').textContent = 'Loading'` in calculation functions. Use signals; let Preact handle DOM updates.
- **Importing Worker module in client code:** The Worker entry (if any) runs in `workerd`, not the browser. Client code is a separate Vite environment.
- **Putting `assets.directory` in source wrangler.jsonc:** The Cloudflare Vite plugin auto-generates this in the output config. Specifying it in source config will cause confusion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSX transform for Preact | Custom Babel config | `@preact/preset-vite` | Handles JSX, HMR (Prefresh), DevTools, React aliasing automatically |
| CSS utility framework | Custom CSS classes | `@tailwindcss/vite` + Tailwind v4 | Zero-config; scans files automatically, no content globs needed |
| Static asset serving | Custom Worker `fetch` handler returning HTML | `assets.not_found_handling: "single-page-application"` | Cloudflare handles SPA routing, asset caching, and 404 fallback |
| Build output config | Manual wrangler.json for deploy | Cloudflare Vite plugin auto-generates | Plugin creates output wrangler.json with correct `assets.directory` |
| React compat aliasing | Manual `resolve.alias` in Vite | `@preact/preset-vite` | Automatically aliases `react` → `preact/compat` |
| State management | Custom pub/sub or event emitter | `@preact/signals` | Native Preact integration; auto re-render; `computed()` for derived state |
| TypeScript Worker types | Manual type definitions | `npx wrangler types` | Generates types from wrangler.jsonc bindings |

**Key insight:** The entire build pipeline (JSX, CSS, bundling, Worker output) is handled by three Vite plugins. No manual Babel, PostCSS, Webpack, or Rollup config needed.

## Common Pitfalls

### Pitfall 1: Missing `type: "module"` in package.json

**What goes wrong:** Vite requires ES module format. Without `"type": "module"` in `package.json`, imports/exports fail with cryptic errors.
**Why it happens:** Existing `package.json` doesn't have this field.
**How to avoid:** Add `"type": "module"` to `package.json` as one of the first steps.
**Warning signs:** `SyntaxError: Cannot use import statement outside a module`

### Pitfall 2: Keeping `main` field in wrangler.jsonc for pure SPA

**What goes wrong:** If `main` points to a Worker that returns HTML (current behavior), it conflicts with the Vite-built SPA. The Worker would intercept requests instead of serving static assets.
**Why it happens:** The current `wrangler.jsonc` has `"main": "src/worker.js"`. When migrating to an SPA, this must be removed.
**How to avoid:** Remove the `main` field from `wrangler.jsonc`. Add `assets.not_found_handling: "single-page-application"` instead. Keep the old `worker.js` file as a reference but don't point `main` at it.
**Warning signs:** Deployed site shows raw JSON or worker error instead of the SPA.

### Pitfall 3: CDN Scripts Not Loading in Dev

**What goes wrong:** SheetJS, Chart.js, and PptxGenJS are loaded via CDN `<script>` tags in `index.html`. In local dev with Vite, these work fine since the HTML is served directly. But if the scripts are referenced as global variables (e.g., `window.XLSX`), TypeScript will complain about undefined globals.
**Why it happens:** CDN scripts inject globals; TypeScript doesn't know about them.
**How to avoid:** Create a `src/types/globals.d.ts` file declaring the global types: `declare const XLSX: any;`, `declare const Chart: any;`, `declare const pptxgen: any;`. These are temporary — later phases will npm-install and properly import.
**Warning signs:** TypeScript errors on `XLSX`, `Chart`, or `pptxgen` being undefined.

### Pitfall 4: Tailwind v4 Purging Existing Classes

**What goes wrong:** The existing app uses custom CSS classes (`.card`, `.nav-btn`, `.badge`, etc.) that overlap with common class names. Tailwind v4 might generate utility classes that conflict.
**Why it happens:** Tailwind v4 auto-scans all files for class names. Existing custom CSS and Tailwind utilities can collide.
**How to avoid:** During Phase 1, keep the existing CSS as-is in a `styles.css` file. Add `@import "tailwindcss"` at the top. Tailwind's utilities will coexist with custom CSS. Migration to Tailwind utility classes happens incrementally in later tasks.
**Warning signs:** Layout breaks, wrong colors, or doubled styles after adding Tailwind.

### Pitfall 5: @preact/signals Production Build Issues

**What goes wrong:** There have been documented issues where signals don't trigger re-renders after `vite build` in certain configurations.
**Why it happens:** The Vite production build may tree-shake or optimize signal subscriptions incorrectly if the preset is misconfigured.
**How to avoid:** Use `@preact/preset-vite` (not manual Babel config). Ensure preset is listed BEFORE the Cloudflare plugin in the Vite plugins array. Test production builds early with `npm run preview`.
**Warning signs:** Signals update but UI doesn't reflect changes in production build only.

### Pitfall 6: Forgetting `index.html` at Project Root

**What goes wrong:** Without an `index.html` in the project root, the Cloudflare Vite plugin won't build the client environment. No static assets will be generated.
**Why it happens:** The plugin auto-detects client build based on presence of `index.html`.
**How to avoid:** Create `index.html` at the project root (not in `src/`). This is Vite's standard convention.
**Warning signs:** `vite build` output only contains worker directory, no client assets.

### Pitfall 7: Not Setting `"type": "module"` Breaks Vite

**What goes wrong:** Vite config and ES module imports fail.
**Why it happens:** The existing `package.json` doesn't specify `"type": "module"`.
**How to avoid:** Add `"type": "module"` to `package.json` when setting up Vite.
**Warning signs:** `ERR_REQUIRE_ESM` or `SyntaxError: Cannot use import statement`

## Code Examples

### Complete vite.config.ts

```typescript
// Source: Cloudflare Vite plugin docs + Preact docs + Tailwind docs
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    cloudflare(),
  ],
});
```

### Complete tsconfig.json (Project References)

```jsonc
// tsconfig.json — base config with references
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### tsconfig.app.json (Preact Application Code)

```jsonc
// tsconfig.app.json — for src/ code
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "react": ["./node_modules/preact/compat/"],
      "react/jsx-runtime": ["./node_modules/preact/jsx-runtime"],
      "react-dom": ["./node_modules/preact/compat/"],
      "react-dom/*": ["./node_modules/preact/compat/*"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

### tsconfig.node.json (Vite Config / Build Tools)

```jsonc
// tsconfig.node.json — for vite.config.ts and build scripts
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

### Updated wrangler.jsonc

```jsonc
// wrangler.jsonc — SPA mode, no Worker entry
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "lossrun",
  "compatibility_date": "2025-12-10",
  "assets": {
    "not_found_handling": "single-page-application"
  },
  "routes": [
    {
      "pattern": "lossrun.voxelplatform.com",
      "zone_name": "voxelplatform.com",
      "custom_domain": true
    }
  ],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "persist": true,
      "invocation_logs": true
    }
  }
}
```

### Updated package.json

```json
{
  "name": "lossrun",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

### Minimal index.html (SPA Entry)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Site Loss & ROI Tool</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- CDN libs kept temporarily (Phase 1) -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### Minimal Preact Entry Point

```tsx
// src/main.tsx
import { render } from "preact";
import { App } from "./app";
import "./styles.css";

render(<App />, document.getElementById("app")!);
```

### Vitest Configuration (Minimal, for Phase 1 Setup)

```typescript
// vitest.config.ts — Source: Cloudflare Vitest docs
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
```

### CDN Globals Type Declaration

```typescript
// src/types/globals.d.ts — Temporary until CDN libs are npm-installed
declare const XLSX: any;
declare const Chart: any;
declare const pptxgen: any;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `wrangler dev` for local development | `vite dev` with `@cloudflare/vite-plugin` | 2025 (plugin GA April 2025) | Full Vite HMR, Environment API integration, prod-parity via workerd |
| `tailwind.config.js` + PostCSS + Autoprefixer | `@tailwindcss/vite` plugin, zero-config | Tailwind v4 (2025) | No config file, no PostCSS setup, just `@import "tailwindcss"` |
| `wrangler deploy` reads source config | `vite build` generates output wrangler.json | Cloudflare Vite plugin | Build generates `dist/` with both client assets and output config; `wrangler deploy` reads from `dist/` |
| Worker returns HTML via `new Response(HTML_CONTENT)` | Static assets via `assets.not_found_handling: "single-page-application"` | Workers Static Assets feature | No Worker invocation for page loads = fewer billable requests |
| React + `useState`/`useReducer` for state | Preact + `@preact/signals` for reactive state | Signals stable 2023+ | Automatic dependency tracking, no manual memoization, fine-grained updates |

**Deprecated/outdated:**
- `site` field in wrangler config: Replaced by `assets` (Workers Static Assets). Do not use.
- `build` field in wrangler config: Replaced by Vite. Not applicable when using the Vite plugin.
- Manual `define`, `alias`, `minify` in wrangler: Use Vite equivalents instead.

## Open Questions

1. **Build output structure with routes**
   - What we know: The Cloudflare Vite plugin generates an output `wrangler.json` in `dist/`. The `routes` field from source config should be preserved in the output.
   - What's unclear: Whether `routes` with `custom_domain: true` works seamlessly with the auto-generated output config. Need to verify on first deploy.
   - Recommendation: Deploy to workers.dev first (test URL), verify SPA works, then deploy with routes to production domain.

2. **Vitest pool-workers compatibility with SPA-only (no main field)**
   - What we know: `@cloudflare/vitest-pool-workers` expects a Worker entry point via `wrangler.configPath`. Our Phase 1 SPA has no `main` field.
   - What's unclear: Whether Vitest pool-workers can work without a Worker entry for client-side logic tests. It may only be needed for Worker-specific tests.
   - Recommendation: Set up Vitest with standard browser-mode config for client tests. Reserve pool-workers setup for when we add a Worker entry point. Alternatively, use a separate `vitest.config.ts` that doesn't use pool-workers for Phase 1.

3. **CSS transition during extraction**
   - What we know: The existing app has ~300 lines of custom CSS in the template literal. Tailwind v4 is additive — it won't remove existing styles.
   - What's unclear: Whether the exact visual appearance will be preserved pixel-perfectly when CSS is extracted from the template literal into a proper file and processed by Vite.
   - Recommendation: Extract CSS verbatim into `src/styles.css`. Add `@import "tailwindcss"` at the top. Do visual comparison testing before and after. Don't start converting to Tailwind utility classes in Phase 1.

## Sources

### Primary (HIGH confidence)
- Cloudflare Workers Vite Plugin docs — https://developers.cloudflare.com/workers/vite-plugin/ — Get started, API reference, static assets, migration guide, SPA tutorial
- Preact official docs v10 — https://preactjs.com/guide/v10/getting-started — Getting started, signals guide, TypeScript config
- Tailwind CSS v4 installation guide — https://tailwindcss.com/docs/installation/using-vite — Vite plugin setup
- Cloudflare Workers SPA routing — https://developers.cloudflare.com/workers/static-assets/routing/single-page-application — `not_found_handling` configuration
- Cloudflare Vitest integration — https://developers.cloudflare.com/workers/testing/vitest-integration/ — Setup guide, first test

### Secondary (MEDIUM confidence)
- npm @preact/preset-vite v2.10.3 — https://www.npmjs.com/package/@preact/preset-vite — Features, configuration options
- npm @cloudflare/vite-plugin v1.21+ — https://www.npmjs.com/package/@cloudflare/vite-plugin — Version, compatibility
- npm @preact/signals v2.7+ — https://www.npmjs.com/package/@preact/signals — Version confirmation
- TypeScript jsxImportSource docs — https://typescriptlang.org/tsconfig/jsxImportSource.html — Preact JSX config

### Tertiary (LOW confidence)
- WebSearch: brownfield migration patterns — General Strangler Fig pattern; not Preact-specific but validated by Preact docs incremental adoption guide
- WebSearch: @preact/signals production build issues (GitHub #508) — Reported but may be fixed in v2.10.3 preset; needs validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All library versions verified via npm and official docs
- Architecture: HIGH — Based on official Cloudflare tutorial (React SPA with API) adapted for Preact; Preact signals store pattern from official docs
- Vite plugin interop: MEDIUM — No specific docs for Preact preset + Cloudflare plugin together, but both follow standard Vite plugin conventions; the Cloudflare tutorial shows React plugin + Cloudflare plugin together successfully
- Pitfalls: HIGH — Based on official docs warnings and verified configuration requirements
- Brownfield migration: MEDIUM — Strangler Fig is a well-known pattern; specific HTML-template-literal extraction is project-specific

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days — stack is stable, all libs at major versions)
