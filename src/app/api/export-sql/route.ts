import { NextRequest, NextResponse } from "next/server";
import { getWorks, saveWork, getSettings } from "@/lib/mylist/server/store";
import { buildSql } from "@/lib/mylist/sqlbuilder";
import { workSignature } from "@/lib/mylist/signature";

export interface ExportBody {
  ids?: string[] | null; // null = كل الأعمال
  dialect?: string;
  dbName?: string;
  schema?: string;
  imagePrefix?: string;
  start?: number;
  markExported?: boolean;
}

/** بناء ملف SQL (T-SQL أو MySQL) — وبعد التصدير بيحدّث sid و exp_sig */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExportBody;
    const all = await getWorks();
    const settings = await getSettings();
    const imagePrefix = body.imagePrefix !== undefined ? body.imagePrefix : settings.image_url_prefix;
    const { sql, stats, sids } = buildSql(all, body.ids ?? null, {
      dialect: body.dialect || settings.dialect,
      dbName: body.dbName !== undefined ? body.dbName : settings.db_name,
      schema: body.schema !== undefined ? body.schema : settings.schema,
      imagePrefix,
      start: body.start || 1001,
    });
    if (body.markExported) {
      const now = new Date().toISOString().slice(0, 19);
      for (const w of all) {
        if (!stats.ids.includes(w.id)) continue;
        const sid = sids[w.id] || w.sid;
        await saveWork({ ...w, sid, expSig: workSignature({ ...w, sid }) , added: w.added || now });
      }
    }
    return NextResponse.json({ sql, stats, sids });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل بناء SQL" }, { status: 500 });
  }
}
