import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const ocrText = (form.get("ocrText") as string | null) ?? null;
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from("receipts")
    .upload(path, new Uint8Array(arrayBuffer), { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: insErr } = await supabase
    .from("receipt_files")
    .insert({
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      ocr_text: ocrText,
      uploaded_by: user.id
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 30);
  return NextResponse.json({ receipt: row, signedUrl: signed?.signedUrl ?? null });
}
