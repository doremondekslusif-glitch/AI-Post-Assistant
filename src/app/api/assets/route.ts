import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function validImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 4)) === "GIF8";
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") return new TextDecoder().decode(bytes.slice(4, 12)).includes("ftypavif");
  return false;
}

export async function POST(request: NextRequest) {
  if (!isRequestAuthenticated(request)) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form upload tidak valid." }, { status: 400 });
  }

  const file = form.get("file");
  const requestedTitle = form.get("title");
  if (!(file instanceof File)) return NextResponse.json({ error: "Pilih satu gambar terlebih dahulu." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Format yang didukung: JPG, PNG, WEBP, GIF, dan AVIF." }, { status: 415 });
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Ukuran gambar maksimal 12 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImageSignature(bytes, file.type)) return NextResponse.json({ error: "Isi file tidak cocok dengan format gambar yang dipilih." }, { status: 415 });

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Konfigurasi server Supabase belum lengkap. Fitur upload belum dapat digunakan." }, { status: 503 });
  }

  const safeName = file.name.replace(/[\\/\\u0000-\\u001f]/g, "_").slice(0, 180) || "gambar";
  const projectTitle = typeof requestedTitle === "string" && requestedTitle.trim()
    ? requestedTitle.trim().slice(0, 120)
    : safeName.replace(/\\.[^.]+$/, "").slice(0, 120) || "Analisis gambar";
  const projectId = randomUUID();
  const assetId = randomUUID();
  const storagePath = `${projectId}/${assetId}`;

  const projectResult = await supabase.from("projects").insert({ id: projectId, title: projectTitle, status: "active" }).select("id").single();
  if (projectResult.error) return NextResponse.json({ error: "Proyek belum bisa dibuat. Periksa konfigurasi database." }, { status: 502 });

  const storageResult = await supabase.storage.from("media-originals").upload(storagePath, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (storageResult.error) {
    await supabase.from("projects").delete().eq("id", projectId);
    return NextResponse.json({ error: "Gambar gagal disimpan ke storage privat. Periksa bucket dan kunci server." }, { status: 502 });
  }

  const assetResult = await supabase.from("assets").insert({
    id: assetId,
    project_id: projectId,
    original_name: safeName,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    media_kind: "image",
    position: 0,
  }).select("id, project_id, original_name, mime_type, size_bytes, created_at").single();

  if (assetResult.error) {
    await supabase.storage.from("media-originals").remove([storagePath]);
    await supabase.from("projects").delete().eq("id", projectId);
    return NextResponse.json({ error: "Metadata gambar gagal disimpan." }, { status: 502 });
  }

  return NextResponse.json({ project: { id: projectId, title: projectTitle }, asset: assetResult.data }, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
