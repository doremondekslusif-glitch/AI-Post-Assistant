"use client";

import { FormEvent, useState } from "react";

export default function PasswordSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (newPassword.length < 12) {
      setMessage("Kata sandi baru harus minimal 12 karakter.");
      return;
    }
    if (newPassword !== confirmation) {
      setMessage("Konfirmasi kata sandi baru belum cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      setMessage("Kata sandi baru harus berbeda dari kata sandi lama.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kata sandi gagal diganti.");
      setSuccess(true);
      setMessage("Kata sandi berhasil diganti. Gunakan kata sandi baru saat login berikutnya.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel password-panel" onSubmit={submit}>
      <div className="eyebrow">Pengaturan akun</div>
      <h2 style={{ fontSize: 25, margin: "10px 0 8px" }}>Ganti kata sandi</h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Perubahan disimpan sebagai hash aman di database. Kata sandi tidak disimpan sebagai teks biasa.
      </p>
      <label className="field-label" htmlFor="current-password">Kata sandi saat ini</label>
      <input
        id="current-password"
        className="field"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        maxLength={1024}
        required
      />
      <label className="field-label" htmlFor="new-password">Kata sandi baru</label>
      <input
        id="new-password"
        className="field"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        minLength={12}
        maxLength={1024}
        required
      />
      <p className="muted helper-text">Minimal 12 karakter. Lebih baik gunakan frasa panjang yang unik.</p>
      <label className="field-label" htmlFor="confirm-password">Ulangi kata sandi baru</label>
      <input
        id="confirm-password"
        className="field"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        minLength={12}
        maxLength={1024}
        required
      />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan kata sandi baru"}
      </button>
      {message && <p className={success ? "success-text" : "error"} role="status">{message}</p>}
      <p className="muted helper-text">Catatan: sesi yang sudah aktif tetap berlaku sampai kedaluwarsa atau logout.</p>
    </form>
  );
}
