"use client";

import { useRef, useState } from "react";
import {
  type Basis,
  type LabelData,
  formatValue,
  scaleNutrients,
} from "@/lib/convert";

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LabelData | null>(null);
  const [basis, setBasis] = useState<Basis>("per_100");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setData(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (!json.nutrients || json.nutrients.length === 0) {
        setError(json.notes ?? "No nutrition data detected.");
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const scaled = data ? scaleNutrients(data, basis) : null;

  return (
    <main>
      <header>
        <h1>Label → Metric</h1>
        <span className="tag">per 100 g / 100 mL</span>
      </header>

      <div className="dropzone">
        <strong>Snap a US food label</strong>
        <p>It&apos;ll come back in real units.</p>
        <div className="btn-row">
          <button onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? "Reading…" : "Take / choose photo"}
          </button>
          {data && (
            <button
              className="btn secondary"
              onClick={() => {
                setData(null);
                setPreview(null);
                setError(null);
              }}
            >
              New scan
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onChange}
        />
      </div>

      {preview && (
        <div className="preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Captured label" />
        </div>
      )}

      {loading && (
        <div className="status">
          <div className="spinner" /> Reading label…
        </div>
      )}

      {error && !loading && (
        <div className="status error">⚠️ {error}</div>
      )}

      {scaled && data && (
        <section className="result">
          <h2>{data.product_name ?? "Nutrition Facts"}</h2>
          <div className="serving-line">
            {data.serving_size_text
              ? `Label serving: ${data.serving_size_text}`
              : "Serving size not detected"}
            {data.servings_per_container != null
              ? ` · ${data.servings_per_container} per container`
              : ""}
          </div>

          <div className="basis-toggle">
            <button
              className={basis === "per_100" ? "on" : ""}
              onClick={() => setBasis("per_100")}
            >
              per 100 g/mL
            </button>
            <button
              className={basis === "per_serving" ? "on" : ""}
              onClick={() => setBasis("per_serving")}
            >
              per serving
            </button>
          </div>

          <div className="serving-line" style={{ marginTop: -6 }}>
            Showing {scaled.basisLabel}
          </div>

          <table>
            <tbody>
              {scaled.nutrients
                .filter((n) => n.unit !== "%")
                .map((n, i) => (
                  <tr key={i} className={n.indent ? "subtle" : ""}>
                    <td className="label">{n.label}</td>
                    <td className="val">{formatValue(n)}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {data.notes && (
            <div className="serving-line" style={{ marginTop: 14 }}>
              Note: {data.notes}
            </div>
          )}
        </section>
      )}

      <footer>
        AI-extracted values. Double-check before relying on them for medical or
        dietary decisions.
      </footer>
    </main>
  );
}
