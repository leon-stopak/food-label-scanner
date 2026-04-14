// Unit conversion + normalization to per-100g / per-100mL.
// All mass outputs are in grams (g) or milligrams (mg) as appropriate.

export type Basis = "per_serving" | "per_100";

export type Nutrient = {
  key: string;
  label: string;
  amount_per_serving: number | null; // in the unit below
  unit: string; // "g" | "mg" | "mcg" | "kcal" | "kJ" | "IU" | "%"
  indent?: boolean;
};

export type LabelData = {
  product_name?: string | null;
  serving_size_text?: string | null; // raw text, e.g. "2/3 cup (55g)"
  serving_size_g?: number | null;    // grams if solid
  serving_size_ml?: number | null;   // mL if liquid
  servings_per_container?: number | null;
  nutrients: Nutrient[];
  notes?: string | null;
};

// Convert an imperial serving string to metric grams or mL if the label didn't
// already include a metric amount. Best-effort only.
export function inferMetricServing(
  text: string | null | undefined
): { grams?: number; ml?: number } {
  if (!text) return {};
  const t = text.toLowerCase();

  // Parenthetical "(55 g)" or "(240 ml)" wins.
  const g = t.match(/\(\s*([\d.]+)\s*g\b/);
  if (g) return { grams: parseFloat(g[1]) };
  const ml = t.match(/\(\s*([\d.]+)\s*ml\b/);
  if (ml) return { ml: parseFloat(ml[1]) };

  // Rough fallback: "8 fl oz" -> 240 mL, "1 oz" -> 28.35 g, "1 cup" ≈ 240 mL.
  const flOz = t.match(/([\d./]+)\s*fl\s*oz/);
  if (flOz) return { ml: parseFraction(flOz[1]) * 29.5735 };
  const cup = t.match(/([\d./]+)\s*cups?/);
  if (cup) return { ml: parseFraction(cup[1]) * 240 };
  const oz = t.match(/([\d./]+)\s*oz\b/);
  if (oz) return { grams: parseFraction(oz[1]) * 28.3495 };
  const tbsp = t.match(/([\d./]+)\s*tbsp/);
  if (tbsp) return { ml: parseFraction(tbsp[1]) * 14.7868 };
  const tsp = t.match(/([\d./]+)\s*tsp/);
  if (tsp) return { ml: parseFraction(tsp[1]) * 4.9289 };

  return {};
}

function parseFraction(s: string): number {
  // Handles "1/2", "1.5", "2/3"
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(parseFloat);
    return a / b;
  }
  return parseFloat(s);
}

export function scaleNutrients(
  label: LabelData,
  basis: Basis
): { nutrients: Nutrient[]; basisLabel: string } {
  if (basis === "per_serving") {
    return {
      nutrients: label.nutrients,
      basisLabel: label.serving_size_text
        ? `per serving (${label.serving_size_text})`
        : "per serving",
    };
  }

  // Determine divisor to scale amounts to per-100 units.
  const inferred = inferMetricServing(label.serving_size_text);
  const grams = label.serving_size_g ?? inferred.grams;
  const ml = label.serving_size_ml ?? inferred.ml;

  let divisor = 0;
  let basisLabel = "per 100 g";
  if (grams && grams > 0) {
    divisor = grams / 100;
  } else if (ml && ml > 0) {
    divisor = ml / 100;
    basisLabel = "per 100 mL";
  } else {
    return {
      nutrients: label.nutrients,
      basisLabel: "per serving (metric serving size unknown)",
    };
  }

  const scaled = label.nutrients.map((n) => ({
    ...n,
    amount_per_serving:
      n.amount_per_serving == null || n.unit === "%"
        ? n.amount_per_serving
        : +(n.amount_per_serving / divisor).toPrecision(3),
  }));

  return { nutrients: scaled, basisLabel };
}

export function formatValue(n: Nutrient): string {
  if (n.amount_per_serving == null) return "—";
  const v = n.amount_per_serving;
  // Drop trailing zeros, keep at most 1 decimal for >=10, 2 for <10, 3 for <1.
  const formatted =
    Math.abs(v) >= 10
      ? v.toFixed(1).replace(/\.0$/, "")
      : Math.abs(v) >= 1
      ? v.toFixed(2).replace(/\.?0+$/, "")
      : v.toFixed(3).replace(/\.?0+$/, "");
  return `${formatted} ${n.unit}`;
}
