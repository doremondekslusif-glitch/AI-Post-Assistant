import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";
import { isValidSessionToken, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  if (isValidSessionToken(cookieStore.get(sessionCookie.name)?.value)) redirect("/dashboard");

  return (
    <main className="login-wrap">
      <div className="login-grid">
        <section className="hero-copy">
          <div className="hero-orb" aria-hidden="true">✳</div>
          <div className="eyebrow">Your private content studio</div>
          <h1>Konten siap posting.<br /><span style={{ color: "var(--accent)" }}>Tanpa mulai dari nol.</span></h1>
          <p className="muted">Ubah desain dan video yang sudah kamu punya menjadi caption, hashtag, judul, dan ide konten yang disesuaikan untuk setiap platform.</p>
          <div className="notice" style={{ maxWidth: 390, marginTop: 28 }}>⌁ <span>Workspace pribadi · Akses satu kata sandi · Media tetap milikmu</span></div>
        </section>
        <section className="panel">
          <div className="eyebrow">Private workspace</div>
          <h2 style={{ fontSize: 26, margin: "12px 0 8px" }}>Selamat datang kembali</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 26 }}>Masukkan kata sandi bersama untuk melanjutkan.</p>
          <LoginForm />
          <p className="muted" style={{ fontSize: 11, margin: "22px 0 0", textAlign: "center" }}>Akses dibatasi untuk pemilik workspace.</p>
        </section>
      </div>
    </main>
  );
}
