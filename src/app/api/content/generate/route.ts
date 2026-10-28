import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRequestAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  projectId: z.string().uuid(),
  analysisId: z.string().uuid(),
  platforms: z.array(z.enum(["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn", "X", "Pinterest", "Shopee", "Tokopedia"])).min(1).max(9),
  mode: z.enum(["natural", "soft_sell", "direct_sell", "informative", "storytelling"]),
  brief: z.string().max(1200).optional().default(""),
});
const outputSchema = z.object({
  outputs: z.array(z.object({
    platform: z.string(),
    caption: z.string().max(4000),
    hashtags: z.array(z.string().max(100)).max(30),
    title: z.string().max(300),
    cta: z.string().max(500),
    ideas: z.array(z.string().max(500)).max(5),
    altText: z.string().max(1000),
  })).min(1).max(9),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isRequestAuthenticated(request)) return errorResponse("Sesi berakhir. Silakan masuk kembali.", 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== `https://${request.headers.get("host")}` && new URL(origin).host !== request.headers.get("host")) {
    return errorResponse("Permintaan tidak valid.", 403);
  }

  let raw: unknown;
  try { raw = await request.json(); } catch { return errorResponse("Permintaan tidak valid.", 400); }
  const input = requestSchema.safeParse(raw);
  if (!input.success) return errorResponse("Data pembuatan konten tidak valid.", 400);

  let supabase;
  try { supabase = getSupabaseAdmin(); } catch { return errorResponse("Konfigurasi database belum lengkap.", 503); }

  const { data: analysis, error: analysisError } = await supabase.from("analyses")
    .select("id, project_id, visual_observations, extracted_text, user_facts, unverified_claims, corrected_analysis")
    .eq("id", input.data.analysisId).eq("project_id", input.data.projectId).maybeSingle();
  if (analysisError || !analysis) return errorResponse("Analisis tidak ditemukan. Unggah dan analisis gambar terlebih dahulu.", 404);

  const base = analysis.corrected_analysis && typeof analysis.corrected_analysis === "object"
    ? analysis.corrected_analysis as Record<string, unknown>
    : {
        visualObservations: analysis.visual_observations,
        extractedText: analysis.extracted_text,
        userFacts: analysis.user_facts,
        unverifiedClaims: analysis.unverified_claims,
      };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse("Kunci Gemini belum dikonfigurasi di server.", 503);
  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const modeInstructions: Record<string, string> = {
    natural: "gaya natural, jelas, tidak berlebihan",
    soft_sell: "soft selling, mengajak secara halus tanpa tekanan",
    direct_sell: "penjualan langsung tetapi tetap jujur dan tidak agresif",
    informative: "informatif, mengutamakan penjelasan yang berguna",
    storytelling: "storytelling singkat, hanya berdasarkan fakta yang tersedia",
  };

  let currentTrendContext = "Data tren real-time tidak tersedia; jangan mengklaim hashtag sedang trending.";
  try {
    const trendResponse = await fetch("https://trends.google.com/trending/rss?geo=ID", {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
      headers: { "user-agent": "AI-Post-Assistant/1.0" },
    });
    if (trendResponse.ok) {
      const xml = await trendResponse.text();
      const trendTitles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
        .map((match) => (match[1] || match[2] || "").trim())
        .filter((title) => title && !/^(daily search trends|trending now)$/i.test(title))
        .slice(0, 20);
      if (trendTitles.length) currentTrendContext = trendTitles.join(", ");
    }
  } catch {
    // Trend lookup is best-effort; generation must continue if the trend feed is unavailable.
  }

  const prompt = `Buat draf konten media sosial dalam Bahasa Indonesia untuk platform berikut: ${input.data.platforms.join(", ")}.
Gaya: ${modeInstructions[input.data.mode]}.
Brief tambahan dari pengguna: ${input.data.brief || "(tidak ada)"}.
Konteks pencarian populer Indonesia terbaru (gunakan hanya bila benar-benar relevan dengan produk, audiens, dan format; jangan memaksakan tren yang tidak nyambung): ${currentTrendContext}.

SUMBER YANG BOLEH DIGUNAKAN (data hasil analisis gambar yang telah diperiksa pengguna):
${JSON.stringify(base)}

Aturan wajib:
- Jangan mengarang nama merek, harga, diskon, bahan, ukuran, spesifikasi, manfaat, sertifikasi, stok, lokasi, testimoni, atau klaim performa.
- "unverifiedClaims" adalah klaim belum terverifikasi: jangan nyatakan sebagai fakta. Jika klaim itu penting, hilangkan atau tulis dengan jelas sebagai teks yang terlihat di materi, bukan fakta.
- Gunakan hanya pengamatan visual, teks yang terbaca, dan userFacts sebagai dasar faktual. Brief pengguna boleh mengarahkan nada, tetapi bukan bukti untuk fakta yang tidak disebut.
- Jika fakta produk tidak cukup, tulis copy netral yang tidak menambah klaim.
- Buat tiap platform berbeda sewajarnya; sesuaikan format, panjang, hook, CTA, dan niat audiens dengan platformnya.
- Jangan memilih hashtag hanya dari kata yang tertulis di gambar atau menggabungkan kata benda yang kebetulan muncul (misalnya nama kota + jenis barang). Tentukan dulu kategori produk yang benar-benar didukung visual, kemungkinan audiens, tujuan konten, konteks penggunaan, dan format posting; baru pilih hashtag yang membantu calon audiens relevan menemukan konten.
- Hashtag harus spesifik, relevan, dan beragam: gabungkan kata kunci kategori/niche, kebutuhan atau use-case yang masuk akal dari visual, komunitas/niat beli yang relevan, serta brand hanya jika nama brand benar-benar diketahui. Hindari tag generik berlebihan, tag tidak relevan, pengulangan, dan klaim yang tidak didukung.
- Jumlah hashtag sesuai platform: Instagram dan TikTok maksimal 5; LinkedIn dan X 1–3; platform lain gunakan seperlunya dan utamakan kata kunci yang benar-benar relevan.
- Tren berubah cepat. Jangan mengaku sebuah hashtag sedang trending saat ini jika tidak ada data tren terkini yang terverifikasi di sumber input. Jika data tren langsung tidak tersedia, buat pilihan berbasis relevansi pencarian/niche dan tandai ide tren sebagai kandidat untuk diverifikasi manual, bukan fakta tren.
- Caption harus punya hook yang spesifik, manfaat/ide konten yang dapat disimpulkan secara wajar dari visual tanpa mengarang spesifikasi, lalu CTA yang natural untuk platform tersebut. Jangan cuma mengulang judul atau menumpuk kata kunci.
- Ide lanjutan harus berupa konsep konten yang bisa diproduksi (misalnya demo penggunaan jika memang terlihat/masuk akal, detail visual, perbandingan yang dapat dibuktikan, atau pertanyaan audiens), bukan ide generik.
- Alt text mendeskripsikan objek dan detail visual yang benar-benar terlihat, bukan copy promosi atau daftar keyword.
- Tidak ada auto-publish. Hanya draf untuk ditinjau pengguna.
- Balas hanya JSON valid dengan struktur:
{"outputs":[{"platform":"nama platform persis","caption":"...","hashtags":["#..."],"title":"...","cta":"...","ideas":["..."],"altText":"..."}]}
Buat tepat satu objek per platform yang diminta dan pertahankan nama platform persis.`;

  const modelCandidates = [...new Set([configuredModel, "gemini-3.1-flash-lite", "gemini-3.6-flash"])];
  let response: Response | undefined;
  let lastRequestError: unknown;
  for (let index = 0; index < modelCandidates.length; index++) {
    const model = modelCandidates[index];
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.45,
            thinkingConfig: { thinkingLevel: model === "gemini-3.8-flash" ? "low" : "minimal" },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) break;
      if (![429, 503].includes(response.status) || index === modelCandidates.length - 1) break;
      console.warn("[content] fallback_model", { failedModel: model, status: response.status, nextModel: modelCandidates[index + 1] });
      response = undefined;
    } catch (error) {
      lastRequestError = error;
      console.warn("[content] model_request_failed", { model, name: error instanceof Error ? error.name : "UNKNOWN" });
      response = undefined;
      if (index === modelCandidates.length - 1) {
        console.error("[content] provider_request_failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
        return errorResponse("Layanan AI utama dan cadangan tidak merespons. Coba lagi beberapa saat.", 504);
      }
    }
  }
  if (!response) {
    console.error("[content] provider_no_response", { hadRequestError: Boolean(lastRequestError) });
    return errorResponse("Layanan AI belum merespons. Coba lagi sebentar.", 504);
  }
  if (!response.ok) {
    const status = response.status;
    let providerMessage = "";
    try { const body = await response.json(); providerMessage = typeof body?.error?.message === "string" ? body.error.message.slice(0, 180) : ""; } catch {}
    console.error("[content] provider_http_error", { status, message: providerMessage || "No provider message" });
    if (status === 429) return errorResponse("Kuota Gemini sedang habis atau dibatasi. Coba lagi nanti.", 429);
    return errorResponse(`Gemini gagal membuat draf (HTTP ${status}).${providerMessage ? " " + providerMessage : ""}`, 502);
  }

  let text = "";
  try {
    const body = await response.json();
    text = body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
  } catch {}
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return errorResponse("Jawaban AI tidak berbentuk JSON yang valid. Coba lagi.", 502); }
  const validated = outputSchema.safeParse(parsed);
  if (!validated.success) return errorResponse("Struktur draf AI tidak sesuai format. Coba lagi.", 502);

  const requested = new Set(input.data.platforms);
  const normalized = validated.data.outputs.filter((item) => requested.has(item.platform as typeof input.data.platforms[number]));
  if (normalized.length !== input.data.platforms.length) {
    return errorResponse("AI tidak mengembalikan draf untuk semua platform yang dipilih. Coba lagi.", 502);
  }

  const rows = normalized.flatMap((item) => [
    { project_id: input.data.projectId, platform: item.platform, output_type: "caption", content: item.caption, status: "draft" },
    { project_id: input.data.projectId, platform: item.platform, output_type: "hashtags", content: item.hashtags.join(" "), status: "draft" },
    { project_id: input.data.projectId, platform: item.platform, output_type: "title", content: item.title, status: "draft" },
    { project_id: input.data.projectId, platform: item.platform, output_type: "cta", content: item.cta, status: "draft" },
    { project_id: input.data.projectId, platform: item.platform, output_type: "ideas", content: item.ideas.join("\n"), status: "draft" },
    { project_id: input.data.projectId, platform: item.platform, output_type: "alt_text", content: item.altText, status: "draft" },
  ]);
  const { data: saved, error: saveError } = await supabase.from("content_outputs").insert(rows).select("id, platform, output_type, content, status, created_at");
  if (saveError || !saved) {
    console.error("[content] save_failed", { code: saveError?.code || "NO_DATA" });
    return errorResponse("Draf berhasil dibuat AI, tetapi gagal disimpan. Coba lagi.", 502);
  }

  return NextResponse.json({ ok: true, outputs: normalized, savedCount: saved.length, saved }, {
    headers: { "Cache-Control": "no-store" },
  });
}
