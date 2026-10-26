import { NextRequest, NextResponse } from "next/server";
import { getImage } from "@/lib/mylist/server/store";

/** عرض صورة مرفوعة بالـ id */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const img = await getImage(id.split(".")[0]); // بيقبل images/xxx.jpg كمان
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img.data), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
