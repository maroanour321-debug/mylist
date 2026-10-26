import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/mylist/server/store";
import { searchRaw, filterResults, resolveTmdbKey, redact } from "@/lib/mylist/server/providers";

/** البحث أونلاين من كل المصادر مع بعض */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const flt = req.nextUrl.searchParams.get("flt") || "الكل";
  if (q.length < 2) return NextResponse.json({ results: [], failed: [] });
  try {
    const settings = await getSettings();
    const key = resolveTmdbKey(settings);
    const all = await searchRaw(q, key);
    const results = filterResults(all, flt);
    return NextResponse.json({ results, failed: [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ results: [], failed: [redact(msg, "")], error: redact(msg, "") }, { status: 200 });
  }
}
