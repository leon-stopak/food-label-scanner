# Label → Metric

Snap a US food label, get it back normalized to **per 100 g / 100 mL**. No login. Works from phone camera.

Powered by Google Gemini 2.5 Flash (vision) via a Next.js API route.

## Why Gemini Flash

For this app the per-scan cost comparison lands roughly here (April 2026 pricing — always double-check):

| Model | Input $/M tok | Output $/M tok | Cost/scan* |
|---|---|---|---|
| **Gemini 2.5 Flash** | ~$0.10 | ~$0.40 | **~$0.0002** |
| GPT-4o-mini | ~$0.15 | ~$0.60 | ~$0.0003 |
| Claude Haiku 4.5 | ~$1.00 | ~$5.00 | ~$0.003 |
| Tesseract (browser) | free | free | $0 — but worse accuracy on real labels |

*Assumes ~1k input tokens (image tiles) and ~300 output tokens per scan.

Gemini 2.5 Flash wins on cost and is very solid at structured OCR. Swap providers by editing `app/api/scan/route.ts` if you already have OpenAI or Anthropic credit sitting around.

## Local dev

```bash
npm install
cp .env.example .env.local
# paste your key from https://aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000 — on desktop the file picker opens; on mobile it offers the camera.

## Deploy to Vercel (90 seconds)

1. `npm i -g vercel` (once)
2. In this folder: `vercel` — answer the prompts, creates a project.
3. Add the env var:
   ```
   vercel env add GOOGLE_API_KEY
   ```
   Paste the key, pick **Production, Preview, Development**.
4. `vercel --prod`

Or via the dashboard: push this folder to GitHub → "New Project" on vercel.com → import → set `GOOGLE_API_KEY` in Project Settings → Environment Variables → deploy.

## How the conversion works

- The vision model pulls out serving size (`240 mL` or `55 g`) plus every nutrient row in the per-serving column.
- Client divides each value by `(serving_size / 100)` when you toggle **per 100 g/mL**.
- If the label only shows imperial (`8 fl oz`, `1 oz`, `1 cup`, `tbsp`, `tsp`) we fall back to standard conversions (see `lib/convert.ts`).
- `%` Daily Value rows are dropped from the metric view (they're a US-specific thing anyway).

## Files that matter

```
app/page.tsx            — camera capture + result UI
app/api/scan/route.ts   — Gemini call + JSON extraction
lib/convert.ts          — serving-size parsing + per-100 scaling
```

## Known limitations

- AI extraction, so double-check before relying on it for anything medical/diet-critical.
- Dual-column labels (per serving + per container) — we always take the per-serving column.
- Labels in weird orientations: snap them straight-on for best results.
# food-label-scanner
