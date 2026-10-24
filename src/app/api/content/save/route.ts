import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRequestAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().uuid(),
  edits: z.array(z.object({
    id: z.string().uuid(),
    platform: z.string().min(1).max(80),
    outputType: z.enum(["caption", "hashtags", "title", "cta", "ideas", "alt_text"]),
    content: z.string().max(5000),
  })).min(1).max(54),
});

export async function PUT(request: NextRequest) {
  if (!isRequestAuthenticated(request)) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 }); }
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 }); }
  const input = schema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Data draf tidak valid." }, { status: 400 });

  let supabase;
  try { supabase = getSupabaseAdmin(); } catch { return NextResponse.json({ error: "Konfigurasi database belum lengkap." }, { status: 503 }); }

  for (const edit of input.data.edits) {
    const { data, error } = await supabase.from("content_outputs")
      .update({ content: edit.content, updated_at: new Date().toISOString() })
      .eq("id", edit.id)
      .eq("project_id", input.data.projectId)
      .eq("platform", edit.platform)
      .eq("output_type", edit.outputType)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      console.error("[content] edit_save_failed", { code: error?.code || "NO_MATCH", outputType: edit.outputType });
      return NextResponse.json({ error: "Sebagian draf tidak berhasil disimpan. Muat ulang hasil dan coba lagi." }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true, message: "Perubahan draf berhasil disimpan." }, { headers: { "Cache-Control": "no-store" } });
}
