"use client";
// نافذة "استخراج SQL": خيارات + فحص قبل التصدير + النتيجة (نسخ/تنزيل) + تعليم الحالات "متصدّر"
import { useEffect, useMemo, useState } from "react";
import { useStore, filterMyList } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, FileDown, Copy, ShieldAlert, CheckCircle2 } from "lucide-react";
import { stateOf, validationReport } from "@/lib/mylist/logic";
import type { Work } from "@/lib/mylist/types";

interface SqlStats {
  works: number;
  episodes: number;
  servers: number;
  skipped: string[];
  dialect: string;
  ids: string[];
}

export function ExportDialog() {
  const open = useStore((s) => s.dialogs.exportOpen);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const settings = useStore((s) => s.settings);
  const loadWorks = useStore((s) => s.loadWorks);
  const query = useStore((s) => s.query);
  const catFilter = useStore((s) => s.catFilter);
  const { toast } = useToast();

  const [onlyPending, setOnlyPending] = useState(true);
  const [dbName, setDbName] = useState(settings.db_name);
  const [schema, setSchema] = useState(settings.schema);
  const [imagePrefix, setImagePrefix] = useState(settings.image_url_prefix);
  const [markExported, setMarkExported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sql: string; stats: SqlStats } | null>(null);

  useEffect(() => {
    if (open) {
      setDbName(settings.db_name);
      setSchema(settings.schema);
      setImagePrefix(settings.image_url_prefix);
      setResult(null);
    }
  }, [open, settings]);

  // الأعمال المتاحة: (الجديد والمعدّل بس) أو كل الأعمال/الفلترة الحالية
  const pendingIds = useMemo(() => works.filter((w) => stateOf(w) !== "done").map((w) => w.id), [works]);
  const scopedWorks = useMemo(() => {
    const base = filterMyList(works, query, catFilter);
    return onlyPending ? base.filter((w) => stateOf(w) !== "done") : base;
  }, [works, query, catFilter, onlyPending]);

  const preCheck = useMemo(() => validationReport(scopedWorks, imagePrefix), [scopedWorks, imagePrefix]);

  if (!open) return null;
  const close = (): void => setDialog("exportOpen", false);

  const build = async (): Promise<void> => {
    if (!scopedWorks.length) {
      toast({ title: "مفيش أعمال للتصدير", description: onlyPending ? "كل الأعمال متصدّرة بالفعل — شيل «الجديد والمعدّل بس» لو عايز تعيد" : undefined });
      return;
    }
    setBusy(true);
    try {
      const ids = onlyPending ? scopedWorks.map((w) => w.id) : scopedWorks.map((w) => w.id);
      const res = await fetch("/api/export-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, dialect: settings.dialect, dbName, schema, imagePrefix, markExported }),
      });
      const data = (await res.json()) as { sql?: string; stats?: SqlStats; error?: string };
      if (data.error || !data.sql) {
        toast({ title: data.error || "فشل بناء SQL", variant: "destructive" });
        return;
      }
      setResult({ sql: data.sql, stats: data.stats! });
      await loadWorks(true);
      toast({ title: `اتبنى الملف: ${data.stats!.works} عمل · ${data.stats!.episodes} حلقة · ${data.stats!.servers} سيرفر` });
    } catch {
      toast({ title: "فشل الاتصال بالسيرفر", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const download = (): void => {
    if (!result) return;
    const blob = new Blob(["\ufeff" + result.sql], { type: "application/sql;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vibehub_import_${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>استخراج SQL — قاعدة vibehub</DialogTitle>
          <DialogDescription>
            الملف بيفتح في {settings.dialect === "mysql" ? "phpMyAdmin ← قاعدة vibehub ← Import" : "SSMS أو Azure Data Studio"}. تقدر تستورده أكتر من مرة: بيحدّث نفس الأعمال من غير ما يكرر.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-bold">الجديد والمعدّل بس</p>
              <p className="text-[11px] text-muted-foreground">الأعمال اللي عمرها ما اتصدّرت أو اتعدّلت بعد آخر تصدير ({pendingIds.length} عمل) — والأعمال اللي ظاهرة قدامك بالفلتر الحالي ({scopedWorks.length}).</p>
            </div>
            <Switch checked={onlyPending} onCheckedChange={setOnlyPending} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>اسم القاعدة</Label>
              <Input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="vibehub" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>الـ Schema</Label>
              <Input value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="dbo" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>مسار رفع الصور</Label>
              <Input value={imagePrefix} onChange={(e) => setImagePrefix(e.target.value)} placeholder="/uploads/posters/" dir="ltr" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-bold">علّم الأعمال المصدّرة «متصدّر»</p>
              <p className="text-[11px] text-muted-foreground">بعد بناء الملف، الحالات بتتحدّث في الموقع (جديد/معدّل ← متصدّر).</p>
            </div>
            <Switch checked={markExported} onCheckedChange={setMarkExported} />
          </div>

          {/* فحص قبل الاستخراج */}
          <div className={cn("rounded-xl border p-3 space-y-1.5", preCheck.errors ? "border-red-200 bg-red-50/60" : preCheck.warns ? "border-amber-200 bg-amber-50/60" : "border-teal-200 bg-teal-50/60")}>
            <p className="text-sm font-bold flex items-center gap-1.5">
              {preCheck.errors ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-red-600" /> الفحص لقى {preCheck.errors} خطأ و{preCheck.warns} تنبيه
                </>
              ) : preCheck.warns ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600" /> {preCheck.warns} تنبيه (الأخطاء بتتخطى في الـ SQL)
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> كل الأعمال المختارة سليمة
                </>
              )}
            </p>
            {(preCheck.errors > 0 || preCheck.warns > 0) && (
              <pre className="text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto leading-5 text-foreground/80">{preCheck.text}</pre>
            )}
          </div>

          {/* النتيجة */}
          {result && (
            <div className="space-y-2 ml-fade-up">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-teal-700">
                  {result.stats.works} عمل · {result.stats.episodes} حلقة · {result.stats.servers} سيرفر
                </span>
                {result.stats.skipped.length > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">اتخطى (مفيش لينكات): {result.stats.skipped.join(" · ")}</span>
                )}
              </div>
              <pre className="rounded-xl border border-border bg-slate-950 text-teal-100 p-3 h-52 overflow-auto text-[10px] leading-4" dir="ltr">
                {result.sql.slice(0, 20000)}
                {result.sql.length > 20000 ? "\n… (الملف الكامل في التنزيل)" : ""}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap">
          <Button variant="ghost" onClick={close}>
            إغلاق
          </Button>
          {result && (
            <>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  void navigator.clipboard.writeText(result.sql);
                  toast({ title: "اتنسخ الـ SQL كله" });
                }}
              >
                <Copy className="w-4 h-4 me-1" /> نسخ
              </Button>
              <Button className="rounded-full" onClick={download}>
                <FileDown className="w-4 h-4 me-1" /> تنزيل الملف
              </Button>
            </>
          )}
          {!result && (
            <Button onClick={() => void build()} disabled={busy} className="rounded-full px-6">
              {busy ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : null} بناء الملف
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { Work };
