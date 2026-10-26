import { NextRequest, NextResponse } from "next/server";
import { scrapeSeason, LogLine, ScrapeCancelled, explainError } from "@/lib/mylist/server/scraper";

/** استخراج حلقات وسيرفرات الموسم من موقع (بيشغل scrape_season على السيرفر) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = (body.url || "").trim();
    if (!url) return NextResponse.json({ error: "الرابط فاضي" }, { status: 400 });
    const log: LogLine[] = [];
    const results = await scrapeSeason(url, (line) => {
      if (log.length < 4000) log.push(line);
    });
    return NextResponse.json({ results, log });
  } catch (e) {
    if (e instanceof ScrapeCancelled) {
      return NextResponse.json({ results: [], log: [], cancelled: true });
    }
    return NextResponse.json({ error: explainError(e) }, { status: 200 });
  }
}
