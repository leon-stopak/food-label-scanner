import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LabelData } from "@/lib/convert";

export const runtime = "nodejs";
export const maxDuration = 30;

const PROMPT = `You are extracting nutrition facts from a US food label image.

Return STRICT JSON (no prose, no markdown) matching this TypeScript shape:

{
  "product_name": string | null,
  "serving_size_text": string | null,      // e.g. "2/3 cup (55g)"
  "serving_size_g": number | null,         // grams, if the product is solid
  "serving_size_ml": number | null,        // mL, if the product is liquid
  "servings_per_container": number | null,
  "nutrients": Array<{
    "key": string,                          // snake_case, e.g. "total_fat"
    "label": string,                        // display label, e.g. "Total Fat"
    "amount_per_serving": number | null,    // numeric value, in the declared unit
    "unit": "g" | "mg" | "mcg" | "kcal" | "kJ" | "IU" | "%",
    "indent": boolean                       // true for sub-nutrients (Saturated, Trans, Sugars, Added Sugars, etc.)
  }>,
  "notes": string | null
}

Rules:
- Use the PER SERVING column (not per container).
- Calories go in nutrients with unit "kcal".
- Percent Daily Values go as separate entries with unit "%" and key suffix "_dv" (e.g. total_fat_dv) only when explicitly shown.
- If serving size is "240 mL" or "8 fl oz (240 mL)", set serving_size_ml = 240 and leave serving_size_g null.
- If serving size is "55 g" or "2/3 cup (55g)", set serving_size_g = 55 and leave serving_size_ml null.
- If the image is NOT a nutrition label, return: {"product_name": null, "serving_size_text": null, "serving_size_g": null, "serving_size_ml": null, "servings_per_container": null, "nutrients": [], "notes": "Not a nutrition label."}
- Omit nutrients that aren't printed. Do not invent values.
- Output JSON only. No \`\`\` fences.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server missing GOOGLE_API_KEY env var." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large (max 8 MB)." }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const result = await model.generateContent([
      { text: PROMPT },
      { inlineData: { data: base64, mimeType } },
    ]);

    const text = result.response.text();
    let parsed: LabelData;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON.", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error." },
      { status: 500 }
    );
  }
}
