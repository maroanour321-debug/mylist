import { NextRequest, NextResponse } from "next/server";
import { exportBackup, importBackup } from "@/lib/mylist/server/store";

/** تنزيل نسخة احتياطية JSON (نفس شكل my_list_data.json) */
export async function GET() {
  try {
    const json = await exportBackup();
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="my_list_backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل التصدير" }, { status: 500 });
  }
}

/** استرجاع/دمج نسخة احتياطية */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { mode?: "replace" | "merge"; json?: string };
    if (!body.json) return NextResponse.json({ error: "مفيش بيانات" }, { status: 400 });
    const stat = await importBackup(body.json, body.mode === "merge" ? "merge" : "replace");
    return NextResponse.json({ stat });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? `الملف مش سليم: ${e.message}` : "فشل الاسترجاع" }, { status: 500 });
  }
}
