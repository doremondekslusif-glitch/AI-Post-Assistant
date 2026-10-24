import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionToken, sessionCookie } from "@/lib/auth";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

const plannedStages = [
  ["01", "Fondasi dan akses", "Kata sandi bersama, sesi privat, struktur database dan storage."],
  ["02", "Analisis gambar", "Upload gambar, OCR, analisis AI, lalu koreksi hasil sebelum membuat konten."],
  ["03", "Editor konten", "Edit per bagian, simpan otomatis, salin, dan riwayat versi."],
  ["04", "Pemrosesan video", "Analisis visual dan transkrip dengan batas ukuran dan pemrosesan."],
  ["05", "Batch dan carousel", "Analisis mandiri per aset dan urutan slide tetap terjaga."],
];

export default async function DashboardPage() {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(sessionCookie.name)?.value)) redirect("/");

  return (
    <main className="shell dashboard">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✳</span><span>AI Post Assistant</span></div>
        <LogoutButton />
      </header>
      <section className="dash-head">
        <div>
          <div className="eyebrow">Private workspace / Stage 1</div>
          <h1 style={{ fontSize: 42, marginBottom: 10 }}>Selamat datang.</h1>
          <p className="muted" style={{ marginBottom: 0 }}>Fondasi workspace sedang disiapkan. Tahap berikutnya akan dibuka setelah setiap pemeriksaan selesai.</p>
        </div>
        <span className="status">● Fondasi aplikasi</span>
      </section>
      <section className="grid-cards">
        <article className="feature-card"><div className="card-icon">↥</div><h3>Media milikmu</h3><p>Gambar dan video yang sudah dibuat akan menjadi sumber analisis—bukan diedit oleh aplikasi.</p></article>
        <article className="feature-card"><div className="card-icon">✳</div><h3>AI yang terarah</h3><p>Caption, hashtag, judul, CTA, dan rekomendasi platform. Klaim harga atau spesifikasi tidak boleh dikarang.</p></article>
        <article className="feature-card"><div className="card-icon">▤</div><h3>Kontrol penuh</h3><p>Hasil bisa dikoreksi, dibuat ulang per bagian, dan disimpan sebagai versi terpisah.</p></article>
      </section>
      <section style={{ marginTop: 44 }}>
        <div className="eyebrow">Roadmap pengerjaan</div>
        <h2 style={{ fontSize: 25, margin: "10px 0 0" }}>Bangun bertahap, cek tiap tahap</h2>
        <div className="stage-list">
          {plannedStages.map(([number, title, description]) => (
            <div className="stage-row" key={number}>
              <span className="stage-number">{number}</span>
              <div><h3 style={{ fontSize: 15, margin: "2px 0 5px" }}>{title}</h3><p className="muted" style={{ fontSize: 13, margin: 0 }}>{description}</p></div>
            </div>
          ))}
        </div>
      </section>
      <p className="footer">Private by design · Original media is retained until its project is deleted.</p>
    </main>
  );
}
