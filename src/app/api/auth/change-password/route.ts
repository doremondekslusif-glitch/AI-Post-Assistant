import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentPasswordHash,
  hashPassword,
  isRequestAuthenticated,
  verifyPasswordAgainstHash,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, { status: 401 });
  }

  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Origin tidak valid." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Origin tidak valid." }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("currentPassword" in body) ||
    !("newPassword" in body) ||
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return NextResponse.json({ error: "Lengkapi semua kolom kata sandi." }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (currentPassword.length > 1024 || newPassword.length < 12 || newPassword.length > 1024) {
    return NextResponse.json({ error: "Kata sandi baru harus minimal 12 karakter." }, { status: 400 });
  }

  const currentHash = await getCurrentPasswordHash();
  if (!verifyPasswordAgainstHash(currentPassword, currentHash)) {
    return NextResponse.json({ error: "Kata sandi lama tidak cocok." }, { status: 401 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Kata sandi baru harus berbeda dari kata sandi lama." }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("app_settings").upsert(
    {
      key: "password_hash",
      value: hashPassword(newPassword),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error("[auth] password_update_failed", { code: error.code });
    return NextResponse.json({ error: "Kata sandi gagal disimpan. Coba lagi." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, message: "Kata sandi berhasil diganti." });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
