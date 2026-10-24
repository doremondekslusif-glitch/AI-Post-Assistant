import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRequestAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analysisSchema = z.object({
  visualObservations: z.array(z.string().max(1000)).max(20),
  extractedText: z.array(z.string().max(500)).max(40),
  userFacts: z.array(z.string().max(500)).max(20),
  unverifiedClaims: z.array(z.string().max(500)).max(20),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string().max(2000),
});

function unauthorized() {
  return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
}

function serverConfigError() {
  return NextResponse.json({ error: "Konfigurasi server Supabase belum lengkap." }, { status: 503 });
}

export async function POST(request: NextRequest) {
  if (!isRequestAuthenticated(request)) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  const input = z.object({ projectId: z.string().uuid(), assetId: z.string().uuid() }).safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Data gambar tidak valid." }, { status: 400 });

  let supabase;
  try { supabase = getSupabaseAdmin(); } catch { return serverConfigError(); }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, project_id, storage_path, mime_type, original_name, size_bytes")
    .eq("id", input.data.assetId)
    .eq("project_id", input.data.projectId)
    .eq("media_kind", "image")
    .maybeSingle();

  if (assetError || !asset) return NextResponse.json({ error: "Gambar tidak ditemukan di proyek ini." }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Kunci Gemini belum dikonfigurasi di server." }, { status: 503 });

  const { data: blob, error: downloadError } = await supabase.storage.from("media-originals").download(asset.storage_path);
  if (downloadError || !blob) return NextResponse.json({ error: "Gambar tidak dapat dibaca dari storage privat." }, { status: 502 });

  const bytes = Buffer.from(await blob.arrayBuffer());
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `Analisis gambar ini untuk membantu menyiapkan konten media sosial. Balas hanya JSON valid dengan struktur:
{
 "visualObservations": ["hal visual yang benar-benar terlihat"],
 "extractedText": ["teks yang terbaca persis; jangan menebak teks yang buram"],
 "userFacts": [],
 "unverifiedClaims": ["klaim promosi/harga/diskon/spesifikasi yang terlihat tetapi belum bisa diverifikasi"],
 "confidence": "high|medium|low",
 "summary": "ringkasan singkat dalam Bahasa Indonesia"
}
Aturan: jangan mengarang harga, diskon, merek, bahan, ukuran, manfaat, atau spesifikasi. userFacts harus kosong karena belum ada fakta yang diberikan pengguna. Bedakan teks promosi yang tampak di gambar dari fakta terverifikasi. Jika tidak yakin, sebutkan ketidakpastian. Jangan membuat caption dulu.`;

  let aiResponse: Response;
  try {
    aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: prompt },
          { inline_data: { mime_type: asset.mime_type, data: bytes.toString("base64") } },
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    return NextResponse.json({ error: "Layanan AI tidak merespons. Coba lagi sebentar." }, { status: 504 });
  }

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    return NextResponse.json({
      error: status === 429 ? "Kuota Gemini sedang habis atau dibatasi. Coba lagi nanti." :
        status === 400 ? "Model atau format gambar ditolak oleh Gemini. Periksa konfigurasi model." :
        status === 401 || status === 403 ? "Kunci Gemini tidak valid atau tidak memiliki akses." :
        "Analisis AI gagal. Coba lagi nanti.",
    }, { status: status === 429 ? 429 : 502 });
  }

  let rawText = "";
  try {
    const responseBody = await aiResponse.json();
    rawText = responseBody.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
  } catch {
    return NextResponse.json({ error: "Jawaban AI tidak bisa dibaca." }, { status: 502 });
  }

  let parsed: unknown;
  try { parsed = JSON.parse(rawText); } catch {
    return NextResponse.json({ error: "Jawaban AI tidak berbentuk JSON yang valid." }, { status: 502 });
  }
  const validated = analysisSchema.safeParse(parsed);
  if (!validated.success) return NextResponse.json({ error: "Struktur jawaban AI tidak sesuai. Coba analisis ulang." }, { status: 502 });

  const { data: analysis, error: insertError } = await supabase.from("analyses").insert({
    project_id: asset.project_id,
    asset_id: asset.id,
    provider: "gemini",
    model,
    status: "completed",
    visual_observations: validated.data.visualObservations,
    extracted_text: validated.data.extractedText,
    user_facts: validated.data.userFacts,
    unverified_claims: validated.data.unverifiedClaims,
    corrected_analysis: null,
  }).select("id, visual_observations, extracted_text, user_facts, unverified_claims, created_at").single();

  if (insertError || !analysis) return NextResponse.json({ error: "Analisis selesai tetapi gagal disimpan." }, { status: 502 });

  return NextResponse.json({
    analysis: {
      id: analysis.id,
      ...validated.data,
      createdAt: analysis.created_at,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!isRequestAuthenticated(request)) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  const input = z.object({
    analysisId: z.string().uuid(),
    correctedAnalysis: analysisSchema,
  }).safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Data koreksi tidak valid." }, { status: 400 });

  let supabase;
  try { supabase = getSupabaseAdmin(); } catch { return serverConfigError(); }
  const { data, error } = await supabase.from("analyses")
    .update({ corrected_analysis: input.data.correctedAnalysis, updated_at: new Date().toISOString() })
    .eq("id", input.data.analysisId)
    .select("id")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Koreksi tidak berhasil disimpan." }, { status: 502 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
