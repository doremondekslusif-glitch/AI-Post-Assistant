import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionToken, sessionCookie } from "@/lib/auth";
import LogoutButton from "./logout-button";
import Link from "next/link";
import ImageWorkspace from "./image-workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(sessionCookie.name)?.value)) redirect("/");

  return (
    <main className="shell dashboard">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✳</span><span>AI Post Assistant</span></div>
        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dashboard/settings" className="small-button">Pengaturan</Link>
          <LogoutButton />
        </nav>
      </header>
      <section className="dash-head">
        <div>
          <div className="eyebrow">Private workspace / Stage 2</div>
          <h1 style={{ fontSize: 42, marginBottom: 10 }}>Analisis gambar.</h1>
          <p className="muted" style={{ marginBottom: 0 }}>Upload desain, periksa apa yang benar-benar terlihat, lalu koreksi hasil analisis sebelum konten dibuat.</p>
        </div>
        <span className="status">● Analisis gambar</span>
      </section>
      <ImageWorkspace />
      <p className="footer">Private by design · Original media is retained until its project is deleted.</p>
    </main>
  );
}
