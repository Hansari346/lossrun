# Stack: Loss Run Analyzer

## Runtime
- **Cloudflare Workers** — Edge compute, serves HTML
- **Wrangler v4.64.0** — CLI for dev/deploy

## Client-Side Libraries (CDN)
- **SheetJS (xlsx) v0.18.5** — Excel file parsing
- **Chart.js v4.4.1** — Data visualization (11 chart types)
- **PptxGenJS v3.12.0** — PowerPoint file generation

## Configuration
- `wrangler.jsonc` — Worker config (route: `lossrun.voxelplatform.com`, observability enabled)
- `package.json` — Minimal, only wrangler as devDependency

## Language
- **JavaScript (ES2022)** — No TypeScript, no JSX
- No build step, no bundler, no framework

## Deployment
- `npx wrangler deploy` → Cloudflare edge
- `npx wrangler dev` → Local development
- Custom domain on `voxelplatform.com` zone

## What's Missing
- No TypeScript
- No CSS framework or preprocessor
- No component framework (React, Vue, etc.)
- No testing framework
- No linting/formatting tools
- No state management
- No build/bundle tooling
