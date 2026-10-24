"use client";

import { useState } from "react";

const PLATFORM_OPTIONS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn", "X", "Pinterest", "Shopee", "Tokopedia"] as const;
type Platform = typeof PLATFORM_OPTIONS[number];
type Mode = "natural" | "soft_sell" | "direct_sell" | "informative" | "storytelling";
type Output = { platform: string; caption: string; hashtags: string[]; title: string; cta: string; ideas: string[]; altText: string };

export default function ContentGenerator({ projectId, analysisId }: { projectId: string; analysisId: string }) {
  const [platforms, setPlatforms] = useState<Platform[]>(["Instagram"]);
  const [mode, setMode] = useState<Mode>("natural");
  const [brief, setBrief] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  function togglePlatform(platform: Platform) {
    setPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
  }

  async function generate() {
    if (!platforms.length) { setMessage("Pilih minimal satu platform."); return; }
    setBusy(true);
    setMessage("");
    setOutputs([]);
    setCopied("");
    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, analysisId, platforms, mode, brief }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Draf gagal dibuat.");
      setOutputs(result.outputs || []);
      setMessage(`Draf tersimpan sebagai draft untuk ${(result.outputs || []).length} platform. Periksa klaim sebelum dipakai.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(platform: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(platform);
    } catch {
      setMessage("Clipboard tidak tersedia di browser ini. Pilih teks lalu salin manual.");
    }
  }

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="eyebrow">Tahap 3 / Editor konten</div>
      <h2 style={{ fontSize: 25, margin: "10px 0 8px" }}>Buat draf untuk platform</h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Draf dibuat dari hasil analisis yang sudah kamu koreksi. Klaim yang belum terverifikasi tidak boleh diperlakukan sebagai fakta. Tidak ada publikasi otomatis.
      </p>
      <label className="field-label">Pilih platform (bisa lebih dari satu)</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8, margin: "10px 0 18px" }}>
        {PLATFORM_OPTIONS.map((platform) => (
          <label key={platform} className="notice" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 12px" }}>
            <input type="checkbox" checked={platforms.includes(platform)} onChange={() => togglePlatform(platform)} />
            <span>{platform}</span>
          </label>
        ))}
      </div>
      <label className="field-label" htmlFor="content-mode">Gaya konten</label>
      <select id="content-mode" className="field" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
        <option value="natural">Natural</option>
        <option value="soft_sell">Soft selling</option>
        <option value="direct_sell">Penjualan langsung</option>
        <option value="informative">Informatif</option>
        <option value="storytelling">Storytelling</option>
      </select>
      <label className="field-label" htmlFor="content-brief">Arahan tambahan (opsional)</label>
      <textarea id="content-brief" className="field" value={brief} maxLength={1200} onChange={(event) => setBrief(event.target.value)} placeholder="Contoh: gunakan bahasa santai, target audiens pemula, hindari emoji berlebihan." />
      <button className="primary" type="button" onClick={generate} disabled={busy || platforms.length === 0} style={{ marginTop: 14 }}>
        {busy ? "Membuat draf…" : "Buat draf konten"}
      </button>
      {message && <p className={message.toLowerCase().includes("gagal") || message.toLowerCase().includes("tidak tersedia") || message.toLowerCase().includes("pilih") ? "error" : "success-text"} role="status">{message}</p>}
      {outputs.map((output) => (
        <article key={output.platform} className="notice" style={{ marginTop: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 19 }}>{output.platform}</h3>
            <button className="small-button" type="button" onClick={() => copy(output.platform, [output.title, output.caption, output.hashtags.join(" "), output.cta].filter(Boolean).join("\n\n"))}>
              {copied === output.platform ? "Tersalin ✓" : "Salin draf"}
            </button>
          </div>
          <label className="field-label">Judul</label>
          <textarea className="field review-textarea" readOnly value={output.title} />
          <label className="field-label">Caption</label>
          <textarea className="field review-textarea" readOnly value={output.caption} />
          <label className="field-label">Hashtag</label>
          <textarea className="field review-textarea" readOnly value={output.hashtags.join(" ")} />
          <label className="field-label">Ajakan (CTA)</label>
          <textarea className="field review-textarea" readOnly value={output.cta} />
          <label className="field-label">Ide lanjutan</label>
          <textarea className="field review-textarea" readOnly value={output.ideas.join("\n")} />
          <label className="field-label">Alt text</label>
          <textarea className="field review-textarea" readOnly value={output.altText} />
          <p className="muted helper-text">Status: draft · Periksa lagi fakta, ejaan, dan kesesuaian platform sebelum menyalin.</p>
        </article>
      ))}
    </section>
  );
}
