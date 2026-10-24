import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionToken, sessionCookie } from "@/lib/auth";
import PasswordSettingsForm from "./password-settings-form";

export const dynamic = "force-dynamic";

export default async function PasswordSettingsPage() {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(sessionCookie.name)?.value)) redirect("/");

  return (
    <main className="shell dashboard">
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">✳</span>
          <span>AI Post Assistant</span>
        </Link>
        <Link href="/dashboard" className="small-button">Kembali ke dashboard</Link>
      </header>
      <section className="dash-head">
        <div>
          <div className="eyebrow">Pengaturan / Keamanan</div>
          <h1 style={{ fontSize: 42, marginBottom: 10 }}>Keamanan akun.</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            Ganti kata sandi akses aplikasi tanpa perlu mengedit variabel lingkungan di Vercel.
          </p>
        </div>
      </section>
      <div style={{ maxWidth: 560 }}>
        <PasswordSettingsForm />
      </div>
      <p className="footer">Jangan bagikan kata sandi. Gunakan kata sandi unik yang tidak dipakai di layanan lain.</p>
    </main>
  );
}
