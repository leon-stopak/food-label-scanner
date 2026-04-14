"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Basis,
  type LabelData,
  formatValue,
  scaleNutrients,
} from "@/lib/convert";

const KEY_STORAGE = "glm_api_key_v1";

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LabelData | null>(null);
  const [basis, setBasis] = useState<Basis>("per_100");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load key from localStorage on mount.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(KEY_STORAGE)
        : null;
    setApiKey(stored);
    setKeyDraft(stored ?? "");
    setHydrated(true);
  }, []);

  function saveKey() {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    window.localStorage.setItem(KEY_STORAGE, trimmed);
    setApiKey(trimmed);
    setSettingsOpen(false);
    setError(null);
  }

  function clearKey() {
    window.localStorage.removeItem(KEY_STORAGE);
    setApiKey(null);
    setKeyDraft("");
  }

  async function handleFile(file: File) {
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    setError(null);
    setData(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/scan", {
        method: "POST",
        body: fd,
        headers: { "x-google-api-key": apiKey },
      });
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
  const needsKey = hydrated && !apiKey;

  return (
    <main>
      <header>
        <h1>Label → Metric</h1>
        <button
          type="button"
          className="btn secondary icon-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="API key settings"
        >
          ⚙
        </button>
      </header>

      {needsKey && !settingsOpen && (
        <div className="status">
          No API key set yet.{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => setSettingsOpen(true)}
          >
            Add your free Gemini key →
          </button>
        </div>
      )}

      <div className="dropzone">
        <strong>Snap a US food label</strong>
        <p>It&apos;ll come back in real units.</p>
        <div className="btn-row">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading || needsKey}
          >
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

      {error && !loading && <div className="status error">⚠️ {error}</div>}

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

      {settingsOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Your Gemini API key</h3>
            <p className="muted">
              Stored only in this browser (localStorage). Never sent anywhere
              except directly to Google when you scan a label.
            </p>
            <p className="muted" style={{ marginTop: 6 }}>
              Get a free one at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
              >
                aistudio.google.com/apikey
              </a>{" "}
              — free tier, no billing required.
            </p>
            <input
              className="key-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
            />
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              {apiKey && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={clearKey}
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveKey}
                disabled={!keyDraft.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
