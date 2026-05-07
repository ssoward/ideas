# HumanMark

A Chrome extension (Manifest V3) that flags AI-generated text on any webpage. It outlines suspicious blocks, drops a small floating badge with a confidence score, and lets you jump between flagged instances on the page.

- **Heuristic mode** — works offline, no API key. ~80% accuracy.
- **API mode (optional)** — use [GPTZero](https://gptzero.me) (10k words/mo free) or [Sapling](https://sapling.ai) for higher accuracy. Text is only sent after explicit consent.
- **Per-site control** — toggle scanning on/off for the current site from the popup, or maintain a global deny list in Settings.
- **Privacy-first defaults** — heuristic mode never makes a network call.

## Install (developer mode)

```bash
npm install
npm run build
```

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked** → select the `dist/` folder
4. Pin the **HM** icon to your toolbar

For a watch build during development: `npm run dev`.

## Usage

- **Red outline + 🤖 badge** — score ≥ AI threshold (default 75%)
- **Amber outline + ⚠️ badge** — score ≥ uncertain threshold (default 50%)
- **Floating HM pill (bottom-right)** — click to hide/show flags, drag to relocate, ◀ ▶ to navigate between flagged blocks. Click any badge to jump to its block.

Open the popup to:

- Toggle the extension globally
- Disable scanning for the current site
- View per-session stats (scanned / flagged / cache hits)

Open Settings (popup → "Settings") to:

- Pick an API provider and paste your key (consent required)
- Adjust AI / uncertain thresholds and minimum text length
- Customize flag colors (presets included)
- Maintain a deny-list of hostnames

## How it works

```
src/
  background/
    service-worker.ts    Routes ANALYZE_BLOCK messages, owns cache + rate limit + stats
    api-client.ts        GPTZero / Sapling adapters + offline heuristic scorer
    cache.ts             chrome.storage.local with TTL + LRU cap (5000 entries)
    rate-limiter.ts      Token bucket persisted to chrome.storage.session
  content/
    content-script.ts    Boot — reads settings, wires up renderer + observer
    block-eligibility.ts CSS selectors + filters for what counts as a "block"
    mutation-observer.ts Watches for new posts/comments; ignores HM's own DOM
    scheduler.ts         Per-tab queue, intersection-observer priority, batching
    renderer.ts          Outlines, badges, floating pill, prev/next nav
    platform-adapters/   Twitter / LinkedIn / Strava signal boosts
  popup/                 Toolbar UI
  options/               Full settings page
  shared/                Types, constants, hash
```

### Detection signals (offline heuristic)

- **Burstiness** — variance in sentence length. AI text is unusually flat.
- **Type-token ratio** — vocabulary uniformity in short passages.
- **Punctuation richness** — em-dashes, ellipses, parentheticals are uncommon in AI output.
- **Platform tweaks** — LinkedIn "3 short bullets + CTA" pattern; Strava boilerplate motivational phrases; Twitter contraction-free, low-emoji tells.

The score is clamped to `[0, 1]` and compared against the configured thresholds.

## Privacy

- Heuristic mode is fully offline.
- API mode is opt-in: provider + key + an explicit consent checkbox are all required before any text leaves the browser.
- The cache stores only the score, hash, source, and timestamp — never the original text.
- The API key is stored in `chrome.storage.local` (the extension's sandboxed storage).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Settings, cache, stats |
| `alarms` | Periodic cache cleanup |
| `tabs` | Read the active tab's hostname for the per-site toggle |
| `<all_urls>` | Content script needs to scan whatever page you're on |

## Build & package for the Chrome Web Store

```bash
./scripts/package.sh           # builds + zips dist/ → humanmark-vX.Y.Z.zip
./scripts/package.sh 0.2.0     # override version
```

Then upload the zip in the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Watch build into `dist/` |
| `npm run build` | One-shot production build |
| `npm run typecheck` | `tsc --noEmit` |
| `./scripts/package.sh` | Build + create store-ready zip |

## Roadmap

- Local ONNX model (quantized DistilRoBERTa) loaded via ONNX Runtime Web in the service worker — targets ~90% accuracy fully offline.
- Per-site sensitivity profiles.
- Export / import of settings and deny-list.
