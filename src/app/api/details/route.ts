import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/mylist/server/store";
import { fetchDetails, resolveTmdbKey } from "@/lib/mylist/server/providers";
import type { SearchResult } from "@/lib/mylist/types";

/** مواسم العمل من المصدر (لما بتضيف عمل من نتايج البحث) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { result?: SearchResult };
    const r = body.result;
    if (!r || !r.source) return NextResponse.json({ seasons: [] });
    const settings = await getSettings();
    const key = resolveTmdbKey(settings);
    const seasons = await fetchDetails(r, key);
    return NextResponse.json({ seasons });
  } catch (e) {
    return NextResponse.json({ seasons: [], error: e instanceof Error ? e.message : "تعذّر جلب المواسم" });
  }
}
