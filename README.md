# Label → Metric

Snap a US food label, get it back normalized to **per 100 g / 100 mL**. No login. Works from phone camera.

Powered by **Gemini 3.1 Flash Lite** (vision) via a Next.js API route. **Bring Your Own Key** — each user pastes their own free Gemini key once and it stays in their browser.

## Why BYOK

Whoever deploys the site doesn't pay for anyone's scans. Every user pastes their own Gemini API key (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no billing required), and the app stores it in their browser's localStorage. The key is sent only with scan requests, only to your own API route, which forwards straight to Google.

Free-tier quota on Gemini 3.1 Flash Lite is plenty for personal use.

## Model choice

Currently set to **Gemini 3.1 Flash Lite** — cheapest capable vision model. Swap one line in `app/api/scan/route.ts`:

| Model | Input $/M | Output $/M | Cost/scan* | Accuracy |
|---|---|---|---|---|
| `gemini-2.5-flash-lite` | ~$0.10 | ~$0.40 | ~$0.0002 | Fine |
| **`gemini-3.1-flash-lite-preview`** (default) | ~$0.25 | ~$1.50 | ~$0.0005 | Good |
| `gemini-3-flash-preview` | ~$0.50 | ~$3.00 | ~$0.0010 | Best for small numbers |

*Assumes ~1k input + ~300 output tokens per scan. All well under Gemini's free tier for personal use — this only matters if you enable billing.

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:3000, click the ⚙ gear, paste your free Gemini key. Done. No `.env` file needed.

(You can still set `GOOGLE_API_KEY` in `.env.local` if you want a server-side fallback for personal use — see below.)

## Deploy to Vercel (90 seconds)

1. `npm i -g vercel` (once)
2. In this folder: `vercel` — answer prompts, creates a project.
3. `vercel --prod`

That's it. No env vars needed — users paste their own keys in the app.

**Optional owner fallback:** if you want the app to work for you without pasting a key each time, add `GOOGLE_API_KEY` as a Vercel env var:
```bash
vercel env add GOOGLE_API_KEY
```
The server uses this if the request doesn't include a user key. Anyone who visits the URL burns *your* quota in that case, so only do this for private personal deployments.

## How the conversion works

- The vision model pulls out serving size (`240 mL` or `55 g`) plus every nutrient row in the per-serving column.
- Client divides each value by `(serving_size / 100)` when you toggle **per 100 g/mL**.
- If the label only shows imperial (`8 fl oz`, `1 oz`, `1 cup`, `tbsp`, `tsp`) we fall back to standard conversions (see `lib/convert.ts`).
- `%` Daily Value rows are dropped from the metric view (they're a US-specific thing anyway).

## Files that matter

```
app/page.tsx            — camera capture + BYOK settings + result UI
app/api/scan/route.ts   — Gemini call (accepts key via x-google-api-key header)
lib/convert.ts          — serving-size parsing + per-100 scaling
```

## Known limitations

- AI extraction, so double-check before relying on it for anything medical/diet-critical.
- Dual-column labels (per serving + per container) — we always take the per-serving column.
- Labels in weird orientations: snap them straight-on for best results.
- `localStorage` BYOK means clearing browser data wipes the saved key.
