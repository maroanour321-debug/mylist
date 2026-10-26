"use client";
// نافذة "إضافة يدوي": اسم + نوع + تصنيف + مواسم/حلقات + جلب بيانات تلقائي (مثل البرنامج)
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { newWork, blankSeasons, isSeriesCat } from "@/lib/mylist/logic";
import { CATEGORIES } from "@/lib/mylist/types";
import type { SeasonT } from "@/lib/mylist/types";

export function ManualAddDialog() {
  const dialog = useStore((s) => s.dialogs.manualAdd);
  const setDialog = useStore((s) => s.setDialog);
  const saveWork = useStore((s) => s.saveWork);
  const autoMeta = useStore((s) => s.settings.auto_metadata);
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"movie" | "series">("series");
  const [category, setCategory] = useState("مسلسل");
  const [nSeasons, setNSeasons] = useState(1);
  const [nEps, setNEps] = useState(1);
  const [overview, setOverview] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<string>("");
  const lookupTimer = useRef<number | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog?.open) {
      setTitle(dialog.title || "");
      setType("series");
      setCategory("مسلسل");
      setNSeasons(1);
      setNEps(1);
      setOverview("");
      setYear("");
      setLookupInfo("");
      setTimeout(() => titleRef.current?.focus(), 60);
    }
  }, [dialog?.open, dialog?.title]);

  // جلب تلقائي (سنة/صورة/وصف) بعد توقف الكتابة — زي manual_add في البرنامج
  useEffect(() => {
    if (!dialog?.open || !autoMeta) return;
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    if (title.trim().length < 2) return;
    lookupTimer.current = window.setTimeout(async () => {
      setLookupInfo("بيجيب بيانات…");
      try {
        const res = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ src: { title, type, category } }),
        });
        const meta = (await res.json()) as { found: boolean; fields: Record<string, string>; matched?: string };
        if (meta.found) {
          if (!year && meta.fields.year) setYear(meta.fields.year);
          if (!overview && meta.fields.overview) setOverview(meta.fields.overview);
          setLookupInfo(`لقيت بيانات: ${meta.matched || ""}`);
        } else setLookupInfo("");
      } catch {
        setLookupInfo("");
      }
    }, 700);
    return () => {
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
     
  }, [title, dialog?.open, autoMeta]);

  if (!dialog) return null;

  const close = (): void => setDialog("manualAdd", null);

  const ok = async (): Promise<void> => {
    if (!title.trim()) {
      toast({ title: "اكتب اسم العمل الأول" });
      return;
    }
    setBusy(true);
    try {
      const w = newWork({
        title: title.trim(),
        type,
        category,
        year,
        overview,
        seasons: type === "movie" ? [{ number: 1, episodes: Array.from({ length: Math.max(1, nEps) }, (_, i) => ({ number: i + 1, title: "", link: "", servers: [] })) }] : blankSeasons(Math.max(1, nSeasons), Math.max(1, nEps)),
      });
      // لو فيلم: الموسم الواحد = اللينكات مباشرة
      const saved = await saveWork(w);
      if (saved) {
        toast({ title: `اتضاف «${w.title}»`, description: "افتحه وزّق لينكات الحلقات" });
        close();
        useStore.getState().openWork(w.id);
      } else toast({ title: "فشل الحفظ", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pickType = (t: "movie" | "series"): void => {
    setType(t);
    setCategory(t === "movie" ? "فيلم" : "مسلسل");
  };

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة يدوي</DialogTitle>
          <DialogDescription>اكتب الاسم وهنرجع له بياناته من المصادر (لو ميزة البيانات التلقائية شغالة). تقدر تعدّل كل حاجة بعدين.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الاسم</Label>
            <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم الفيلم أو المسلسل…" dir="auto" />
            {lookupInfo && (
              <p className="text-[11px] text-primary flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {lookupInfo}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <div className="flex rounded-xl border border-input overflow-hidden">
                <button className={cn("flex-1 py-2 text-sm font-bold transition-colors", type === "series" ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => pickType("series")}>
                  مسلسل
                </button>
                <button className={cn("flex-1 py-2 text-sm font-bold transition-colors", type === "movie" ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => pickType("movie")}>
                  فيلم
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <div className="flex rounded-xl border border-input overflow-hidden">
                {CATEGORIES.filter((c) => (type === "movie" ? c === "فيلم" || c === "أنمي" || c === "كرتون" : c !== "فيلم")).map((c) => (
                  <button key={c} className={cn("flex-1 py-2 text-sm font-bold transition-colors", category === c ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => setCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isSeriesCat(category) ? (
              <div className="space-y-1.5">
                <Label>عدد المواسم</Label>
                <Input type="number" min={1} max={50} value={nSeasons} onChange={(e) => setNSeasons(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            ) : (
              <div />
            )}
            <div className="space-y-1.5">
              <Label>{type === "movie" ? "عدد اللينكات (سيرفرات)" : "عدد الحلقات في كل موسم"}</Label>
              <Input type="number" min={1} max={500} value={nEps} onChange={(e) => setNEps(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>السنة (اختياري)</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
            </div>
            <div className="space-y-1.5 flex flex-col justify-between">
              <Label>البيانات تلقائي</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                <Switch checked={autoMeta} disabled />
                {autoMeta ? "شغالة" : "مقفولة (من الإعدادات)"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>الوصف (اختياري)</Label>
            <Textarea value={overview} onChange={(e) => setOverview(e.target.value)} rows={3} dir="auto" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button onClick={() => void ok()} disabled={busy} className="rounded-full px-6">
            {busy && <Loader2 className="w-4 h-4 me-1 animate-spin" />} إضافة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
