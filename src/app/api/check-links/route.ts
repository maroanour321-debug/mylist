import { NextRequest, NextResponse } from "next/server";
import { checkMany } from "@/lib/mylist/server/providers";

/** فحص لينكات أونلاين: ok = الصفحة بتفتح، warn = بيمنع الفحص الآلي، dead = مش بيرد */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { urls?: string[] };
    const urls = (body.urls || []).slice(0, 300);
    if (!urls.length) return NextResponse.json({ results: [] });
    const results = await checkMany(urls);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل الفحص" }, { status: 500 });
  }
}
