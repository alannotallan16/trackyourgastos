import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OCR_SPACE_API_KEY not set" }, { status: 501 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const upstream = new FormData();
  upstream.append("file", file, file.name);
  upstream.append("language", "eng");
  upstream.append("isTable", "true");
  upstream.append("scale", "true");
  upstream.append("OCREngine", "2");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body: upstream
  });
  const json: any = await res.json();
  if (!res.ok || json.IsErroredOnProcessing) {
    return NextResponse.json({ error: json?.ErrorMessage ?? "OCR failed" }, { status: 500 });
  }
  const text = (json.ParsedResults ?? []).map((r: any) => r.ParsedText ?? "").join("\n");
  return NextResponse.json({ text });
}
