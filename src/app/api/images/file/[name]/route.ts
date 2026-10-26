import { NextRequest, NextResponse } from "next/server";
import { getImage, listImages } from "@/lib/mylist/server/store";

/** عرض صورة مرفوعة بالاسم (poster_local زي images/ab12.jpg) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const clean = name.replace(/^images\//, "");
  const id = clean.replace(/\.[^.]+$/, "");
  const img = await getImage(id);
  if (img) {
    return new NextResponse(new Uint8Array(img.data), {
      headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }
  // fallback: أول صورة بنفس الاسم الأصلي
  const all = await listImages();
  const found = all.find((i) => i.filename.endsWith(clean));
  if (found) {
    const img2 = await getImage(found.id);
    if (img2) {
      return new NextResponse(new Uint8Array(img2.data), {
        headers: { "Content-Type": img2.mime, "Cache-Control": "public, max-age=3600" },
      });
    }
  }
  return new NextResponse("Not found", { status: 404 });
}
