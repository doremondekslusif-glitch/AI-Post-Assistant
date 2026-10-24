"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      window.location.assign("/");
    } finally {
      setBusy(false);
    }
  }
  return <button className="small-button" onClick={logout} disabled={busy}>{busy ? "Keluar…" : "Keluar ↗"}</button>;
}
