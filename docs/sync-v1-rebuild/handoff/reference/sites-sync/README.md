# VeyoCast — Sync V1 reference

Prototype 1 (Sync) is the single retained interface. This repository is the reference implementation for the V1 handover: application, public marketing pages, player experience, assets and acceptance scenarios.

- Private application: https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync
- Public marketing: https://veyocast.dgwebserv.chatgpt.site
- Handover centre: `/?design=sync&page=handover`
- Manual acceptance: `/?design=sync&page=coverage`

## Run and build

```sh
npm ci
npm run dev
npm run check
npm run build
npm run build:marketing
MARKETING_SITE_URL=https://veyocast.dgwebserv.chatgpt.site MARKETING_APP_URL='https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync' node scripts/prerender-marketing.mjs --dir=dist-marketing --template=marketing.html
node scripts/qa-smoke.mjs
node scripts/qa-handover.mjs
node scripts/qa-content.cjs
node scripts/qa-flow.cjs
node scripts/qa-seo.mjs dist-marketing
```

Use a current Node LTS compatible with the locked Vite release. Dependencies are pinned in package-lock.json. The handover does not require replacing the production Next.js stack with Vite.

## Runtime boundaries

All app data, source connections, payment states, MFA and device actions are simulations. Browser localStorage stores demo changes per organization; sessionStorage preserves unfinished Studio drafts. No production API, email, payment or device service is called. Uploaded media remains local to the current browser.

Demo MFA code: `123456`. Pairing code: `VYO482`. Changing roles is a visible simulator. Client permission checks demonstrate interaction behavior and cannot substitute for server authorization.

The public marketing entry imports no tenant store or admin modules. The separate public bundle contains only marketing content and a local demo request form. Requests are explicitly not sent, and local requests do not synchronize across the two Site origins. Production inquiry storage/delivery is an implementation acceptance gate.

See [the handover index](docs/README-OVERDRACHT.md), [V1 canon](docs/V1-SYNC-CANON.md), [Codex instructions](docs/CODEX-BOUWPROMPT.md), and [test results](docs/TESTRESULTATEN.md).

## Assets

`public/assets/brand-hero.png` is the retained 3D Screen Sync hero. Responsive WebP encodings preserve the same image. Logos are outlined transparent SVG files; original font/license files are retained. No alternate design selector is included.

## Validation boundary

Refer to docs/TESTRESULTATEN.md for this version's executed checks. No physical Android/LG, provider integration, payment-chain or browser visual acceptance is claimed. The feature explorer is a manual checklist, not automatic test evidence.
