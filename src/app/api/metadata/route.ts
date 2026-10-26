import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/mylist/server/store";
import { fetchMetadata, resolveTmdbKey } from "@/lib/mylist/server/providers";

/** البيانات التلقائية: نجيب اللي المصادر عندها فعلاً، ومبنألفش حاجة ناقصة */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      src?: { title?: string; year?: string; type?: string; category?: string; source?: string; ext_id?: unknown };
      wantSeasons?: boolean;
    };
    const src = body.src || {};
    const settings = await getSettings();
    const key = resolveTmdbKey(settings);
    const meta = await fetchMetadata(src, key, Boolean(body.wantSeasons));
    return NextResponse.json(meta);
  } catch (e) {
    return NextResponse.json({
      found: false, source: "", matched: "", fields: {},
      error: e instanceof Error ? e.message : "كل المصادر فشلت (مفيش نت مثلاً؟)",
    });
  }
}
