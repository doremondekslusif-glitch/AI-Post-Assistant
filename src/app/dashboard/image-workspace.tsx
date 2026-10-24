"use client";

import { ChangeEvent, useState } from "react";
import ContentGenerator from "./content-generator";

type Analysis = {
  id: string;
  visualObservations: string[];
  extractedText: string[];
  userFacts: string[];
  unverifiedClaims: string[];
  confidence: "high" | "medium" | "low";
  summary: string;
};

type UploadedAsset = { projectId: string; projectTitle: string; assetId: string; fileName: string };

function lines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 40);
}

export default function ImageWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploaded, setUploaded] = useState<UploadedAsset | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [observations, setObservations] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [userFacts, setUserFacts] = useState("");
  const [unverifiedClaims, setUnverifiedClaims] = useState("");
  const [summary, setSummary] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    setFile(next);
    setUploaded(null);
    setAnalysis(null);
    setMessage("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : "");
  }

  async function uploadAndAnalyze() {
    if (!file) { setMessage("Pilih gambar terlebih dahulu."); return; }
    setBusy(true);
    setMessage("");
    setUploaded(null);
    setAnalysis(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      const uploadResponse = await fetch("/api/assets", { method: "POST", body: form, cache: "no-store" });
      const uploadBody = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadBody.error || "Upload gagal.");
      const item: UploadedAsset = {
        projectId: uploadBody.project.id,
        projectTitle: uploadBody.project.title,
        assetId: uploadBody.asset.id,
        fileName: uploadBody.asset.original_name,
      };
      setUploaded(item);
      setMessage("Gambar tersimpan privat. AI sedang menganalisis isi gambar…");

      const analysisResponse = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: item.projectId, assetId: item.assetId }),
        cache: "no-store",
      });
      const analysisBody = await analysisResponse.json();
      if (!analysisResponse.ok) throw new Error(analysisBody.error || "Analisis gagal.");
      const result: Analysis = analysisBody.analysis;
      setAnalysis(result);
      setObservations(result.visualObservations.join("\n"));
      setExtractedText(result.extractedText.join("\n"));
      setUserFacts(result.userFacts.join("\n"));
      setUnverifiedClaims(result.unverifiedClaims.join("\n"));
      setSummary(result.summary);
      setMessage("Analisis selesai. Periksa dan koreksi hasilnya sebelum digunakan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection() {
    if (!analysis) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/analysis", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysisId: analysis.id,
          correctedAnalysis: {
            visualObservations: lines(observations),
            extractedText: lines(extractedText),
            userFacts: lines(userFacts),
            unverifiedClaims: lines(unverifiedClaims),
            confidence: analysis.confidence,
            summary: summary.slice(0, 2000),
          },
        }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Koreksi gagal disimpan.");
      setMessage("Koreksi berhasil disimpan. Data analisis asli tetap dipertahankan terpisah.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Koreksi gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-grid">
      <div className="panel upload-panel">
        <div className="eyebrow">Tahap 2 / Analisis gambar</div>
        <h2 style={{ fontSize: 25, margin: "10px 0 8px" }}>Mulai dari desain yang sudah ada</h2>
        <p className="muted" style={{ fontSize: 13 }}>Upload satu gambar. AI akan membaca elemen visual dan teks, bukan mengedit gambar aslinya.</p>
        <label className="field-label" htmlFor="project-title">Nama proyek (opsional)</label>
        <input id="project-title" className="field" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Desain tumbler merah" />
        <div style={{ height: 16 }} />
        <label className="field-label" htmlFor="image-file">File gambar</label>
        <input id="image-file" className="field file-field" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={chooseFile} />
        <p className="muted helper-text">JPG, PNG, WEBP, GIF, atau AVIF · Maksimal 12 MB per gambar.</p>
        {previewUrl && <div className="preview-wrap"><img src={previewUrl} alt="Pratinjau gambar yang dipilih" className="image-preview" /></div>}
        <button className="primary" type="button" onClick={uploadAndAnalyze} disabled={busy || !file}>
          {busy ? "Memproses…" : "Upload & analisis gambar"}
        </button>
        <div className="notice" style={{ marginTop: 14 }}>Media disimpan di storage privat. Jangan unggah konten sensitif yang tidak perlu diproses AI.</div>
        {message && <p className={message.toLowerCase().includes("gagal") || message.toLowerCase().includes("tidak") || message.toLowerCase().includes("belum") || message.toLowerCase().includes("kuota") ? "error" : "success-text"} role="status">{message}</p>}
      </div>

      <div className="panel review-panel">
        <div className="eyebrow">Review hasil</div>
        <h2 style={{ fontSize: 25, margin: "10px 0 8px" }}>Periksa sebelum lanjut</h2>
        {!analysis ? (
          <div className="empty-review">
            <div className="card-icon">✳</div>
            <p className="muted">Hasil analisis akan muncul di sini. Teks promosi yang belum terverifikasi akan dipisahkan dari pengamatan visual.</p>
          </div>
        ) : (
          <>
            <div className="analysis-meta">
              <span className="status">Keyakinan: {analysis.confidence === "high" ? "tinggi" : analysis.confidence === "medium" ? "sedang" : "rendah"}</span>
              <span className="muted" style={{ fontSize: 12 }}>{uploaded?.fileName}</span>
            </div>
            <label className="field-label" htmlFor="summary">Ringkasan</label>
            <textarea id="summary" className="field review-textarea" value={summary} maxLength={2000} onChange={(event) => setSummary(event.target.value)} />
            <label className="field-label" htmlFor="observations">Pengamatan visual (satu poin per baris)</label>
            <textarea id="observations" className="field review-textarea" value={observations} onChange={(event) => setObservations(event.target.value)} />
            <label className="field-label" htmlFor="extracted-text">Teks yang terbaca (OCR)</label>
            <textarea id="extracted-text" className="field review-textarea" value={extractedText} onChange={(event) => setExtractedText(event.target.value)} />
            <label className="field-label" htmlFor="user-facts">Fakta dari pengguna</label>
            <textarea id="user-facts" className="field review-textarea" value={userFacts} onChange={(event) => setUserFacts(event.target.value)} placeholder="Tambahkan fakta yang benar, satu poin per baris" />
            <label className="field-label" htmlFor="unverified">Klaim yang belum terverifikasi</label>
            <textarea id="unverified" className="field review-textarea" value={unverifiedClaims} onChange={(event) => setUnverifiedClaims(event.target.value)} />
            <button className="primary" type="button" onClick={saveCorrection} disabled={busy}>Simpan koreksi</button>
            <p className="muted helper-text">Koreksi disimpan terpisah; hasil asli AI tidak ditimpa.</p>
          </>
        )}
      </div>
      {analysis && uploaded && <ContentGenerator projectId={uploaded.projectId} analysisId={analysis.id} />}
    </section>
  );
}
