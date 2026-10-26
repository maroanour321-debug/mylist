"use client";
// نافذة "بيانات العمل": كل حقول العمل + الصورة/الخلفية + قفل الحقول المعدّلة يدوي
import { useEffect, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { lockFields } from "@/lib/mylist/logic";
import { CATEGORIES, HUBS } from "@/lib/mylist/types";
import type { Work } from "@/lib/mylist/types";

export function DetailsDialog() {
  const dialog = useStore((s) => s.dialogs.details);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const saveWork = useStore((s) => s.saveWork);
  const setDialogAny = useStore((s) => s.setDialog);
  const { toast } = useToast();
  const work = works.find((w) => w.id === dialog?.workId) || null;
  const [form, setForm] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (dialog?.open && work) {
      setForm({
        title: work.title,
        altTitle: work.altTitle,
        type: work.type,
        category: work.category,
        hub: work.hub,
        year: work.year,
        rating: work.rating,
        studio: work.studio,
        genres: work.genres,
        classification: work.classification,
        overview: work.overview,
        backdrop: work.backdrop,
      });
    }
  }, [dialog?.open, work]);

  if (!dialog) return null;
  const close = (): void => setDialog("details", null);
  if (!work || !form) return <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}><DialogContent className="hidden" /></Dialog>;

  const set = (k: string, v: string): void => setForm((f) => ({ ...(f as Record<string, string>), [k]: v }));

  const ok = async (): Promise<void> => {
    const next: Work = JSON.parse(JSON.stringify(work));
    const lockable: string[] = [];
    for (const [k, v] of Object.entries(form)) {
      const key = k as keyof Work;
      const oldVal = String(work[key] ?? "");
      if (oldVal !== v) {
        (next as unknown as Record<string, string>)[k] = v;
        // أي حقل اتعدّل بالإيد بيتقفل (التحديث التلقائي مبيلمسوش)
        const pyName: Record<string, string> = { altTitle: "alt_title", backdrop: "backdrop" };
        if (["title", "year", "overview", "backdrop", "genres", "rating", "studio", "classification", "altTitle"].includes(k)) lockable.push(pyName[k] || k);
      }
    }
    if (next.type !== form.type) next.type = form.type as Work["type"];
    lockFields(next, lockable);
    const okSaved = await saveWork(next);
    if (okSaved) toast({ title: "اتحفظت بيانات العمل", description: lockable.length ? `اتقفلت ${lockable.length} حقول عدّلتها بإيدك` : undefined });
    else toast({ title: "فشل الحفظ", variant: "destructive" });
    close();
  };

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>بيانات العمل — {work.title}</DialogTitle>
          <DialogDescription>أي حقل تعدّله بإيدك بيتقفل ومش هيتلمس في التحديث التلقائي.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* صورة الخلفية */}
          <div className="space-y-1.5">
            <Label>صورة الخلفية (backdrop)</Label>
            <div className="flex gap-2">
              <Input value={form.backdrop} onChange={(e) => set("backdrop", e.target.value)} placeholder="https://…" dir="ltr" className="flex-1" />
              <Button variant="outline" className="rounded-full shrink-0" onClick={() => setDialogAny("imagePicker", { open: true, workId: work.id, field: "backdrop" })}>
                <ImagePlus className="w-4 h-4 me-1" /> اختيار
              </Button>
              {form.backdrop && (
                <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => set("backdrop", "")} title="إزالة الخلفية">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            {form.backdrop && (
               
              <img src={form.backdrop} alt="معاينة الخلفية" className="mt-1 rounded-xl w-full max-h-40 object-cover border border-border" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} dir="auto" />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم الأصلي</Label>
              <Input value={form.altTitle} onChange={(e) => set("altTitle", e.target.value)} dir="auto" />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <div className="flex rounded-xl border border-input overflow-hidden">
                {(["series", "movie"] as const).map((t) => (
                  <button key={t} className={cn("flex-1 py-2 text-sm font-bold", form.type === t ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => set("type", t)}>
                    {t === "series" ? "مسلسل" : "فيلم"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <div className="flex rounded-xl border border-input overflow-hidden">
                {CATEGORIES.filter((c) => (form.type === "movie" ? c === "فيلم" || c === "أنمي" || c === "كرتون" : c !== "فيلم")).map((c) => (
                  <button key={c} className={cn("flex-1 py-2 text-xs font-bold", form.category === c ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => set("category", c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الهب</Label>
              <select
                value={form.hub}
                onChange={(e) => set("hub", e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                aria-label="الهب"
              >
                {HUBS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>السنة</Label>
              <Input value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="2024" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>التقييم</Label>
              <Input value={form.rating} onChange={(e) => set("rating", e.target.value)} placeholder="7.5" />
            </div>
            <div className="space-y-1.5">
              <Label>الاستوديو / القناة</Label>
              <Input value={form.studio} onChange={(e) => set("studio", e.target.value)} dir="auto" />
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف العمري</Label>
              <Input value={form.classification} onChange={(e) => set("classification", e.target.value)} placeholder="PG-13 / +13" dir="auto" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>الأنواع (مفصولة بفاصلة)</Label>
            <Input value={form.genres} onChange={(e) => set("genres", e.target.value)} placeholder="Action, Drama" dir="auto" />
          </div>

          <div className="space-y-1.5">
            <Label>الوصف</Label>
            <Textarea value={form.overview} onChange={(e) => set("overview", e.target.value)} rows={4} dir="auto" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button onClick={() => void ok()} className="rounded-full px-6">
            {useStore.getState().saving && <Loader2 className="w-4 h-4 me-1 animate-spin" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
