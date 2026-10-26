import { NextRequest, NextResponse } from "next/server";
import { getWorks, saveWork, getMaxSort } from "@/lib/mylist/server/store";

export async function GET() {
  try {
    const works = await getWorks();
    return NextResponse.json({ works });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ في قراءة البيانات" }, { status: 500 });
  }
}

/** إضافة عمل جديد (يدوي أو من نتايج البحث) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sort = await getMaxSort();
    const saved = await saveWork({ ...body, sort });
    return NextResponse.json({ work: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر حفظ العمل" }, { status: 500 });
  }
}
