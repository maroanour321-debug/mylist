import { NextRequest, NextResponse } from "next/server";
import { saveWork, deleteWork } from "@/lib/mylist/server/store";

/** حفظ العمل بالشكل الكامل (upsert) */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const saved = await saveWork({ ...body, id });
    return NextResponse.json({ work: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر حفظ العمل" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await deleteWork(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر حذف العمل" }, { status: 500 });
  }
}
