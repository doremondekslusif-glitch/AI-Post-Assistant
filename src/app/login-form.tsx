"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Terlalu banyak percobaan. Coba lagi nanti." : "Kata sandi tidak cocok.");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Tidak dapat terhubung. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field-label" htmlFor="password">Kata sandi akses</label>
      <input
        id="password"
        className="field"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Masukkan kata sandi"
        required
        minLength={1}
        maxLength={1024}
      />
      <div style={{ height: 18 }} />
      <button className="primary" type="submit" disabled={busy || password.length === 0}>
        {busy ? "Memeriksa akses…" : "Masuk ke workspace"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
