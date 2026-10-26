import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/mylist/server/store";
import type { MySettings } from "@/lib/mylist/types";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MySettings>;
    const settings = await saveSettings(body);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
