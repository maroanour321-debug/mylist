import { NextRequest, NextResponse } from "next/server";
import { listImages, saveImage } from "@/lib/mylist/server/store";

/** مكتبة الصور المرفوعة */
export async function GET() {
  try {
    const images = await listImages();
    return NextResponse.json({ images });
  } catch (e) {
    return NextResponse.json({ images: [], error: e instanceof Error ? e.message : "خطأ" });
  }
}

/** رفع صورة من الجهاز (base64) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { filename?: string; mime?: string; data?: string };
    if (!body.data) return NextResponse.json({ error: "مفيش بيانات صورة" }, { status: 400 });
    const clean = body.data.replace(/^data:[^;]+;base64,/, "");
    const saved = await saveImage(body.filename || "image.jpg", body.mime || "image/jpeg", clean);
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر رفع الصورة" }, { status: 500 });
  }
}
