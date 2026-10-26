import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/mylist/server/store";
import { imageSearch, resolveTmdbKey } from "@/lib/mylist/server/providers";

/** البحث عن صور من مصادر رسمية/مفتوحة: TMDB - TVmaze - iTunes - ويكيبيديا - Commons */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const kind = req.nextUrl.searchParams.get("kind") === "backdrop" ? "backdrop" : "poster";
  try {
    const settings = await getSettings();
    const key = resolveTmdbKey(settings);
    const { items, failed } = await imageSearch(q, key, kind);
    return NextResponse.json({ items, failed });
  } catch (e) {
    return NextResponse.json({ items: [], failed: [e instanceof Error ? e.message : "فشل البحث"] });
  }
}
