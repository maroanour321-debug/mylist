"use client";
// نافذة التقرير (فحص العمل) + نافذة النسخ الاحتياطي (استرجاع/دمج) + نافذة الشرح
import { useRef, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, Upload, Download, DatabaseBackup, Loader2, ListChecks, Search, ImagePlus, ClipboardPaste, Globe, FileDown, Sparkles, Server } from "lucide-react";
import type { Work } from "@/lib/mylist/types";

// ---------------------------------------------------------------------------
// تقرير الفحص
// ---------------------------------------------------------------------------
export function ReportDialog() {
  const dialog = useStore((s) => s.dialogs.report);
  const setDialog = useStore((s) => s.setDialog);
  if (!dialog) return null;
  const close = (): void => setDialog("report", null);

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialog.errors ? <ShieldAlert className="w-5 h-5 text-red-600" /> : dialog.warns ? <ShieldAlert className="w-5 h-5 text-amber-600" /> : <ShieldCheck className="w-5 h-5 text-teal-600" />}
            {dialog.title}
          </DialogTitle>
          <DialogDescription>
            الأخطاء: {dialog.errors} · التنبيهات: {dialog.warns} — الخطأ معناه إن العمل هيتخطى أو بيان ناقص في الـ SQL، والتنبيه مجرد تنبيه.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-xl border border-border bg-muted/40 p-4 text-xs leading-6 whitespace-pre-wrap" dir="rtl">
          {dialog.text}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// استرجاع / دمج نسخة احتياطية
// ---------------------------------------------------------------------------
export function BackupDialog() {
  const open = useStore((s) => s.dialogs.backupOpen);
  const setDialog = useStore((s) => s.setDialog);
  const loadWorks = useStore((s) => s.loadWorks);
  const { toast } = useToast();
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;
  const close = (): void => setDialog("backupOpen", false);

  const onFile = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, json: text }),
      });
      const data = (await res.json()) as { stat?: { added: number; updated: number; skipped: number }; error?: string };
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }
      await loadWorks();
      toast({
        title: mode === "merge" ? "تم الدمج" : "تم الاسترجاع",
        description: `اتضاف ${data.stat?.added ?? 0} · اتحدث ${data.stat?.updated ?? 0} · اتساب ${data.stat?.skipped ?? 0}`,
      });
      close();
    } catch {
      toast({ title: "الملف مش سليم أو مش JSON", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseBackup className="w-5 h-5 text-primary" /> استرجاع / دمج نسخة احتياطية
          </DialogTitle>
          <DialogDescription>الملف بتاع البرنامج الأصلي (my_list_data.json) أو النسخة الاحتياطية اللي نزلتها من الموقع — الاثنين شغالين.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("merge")}
              className={cn("rounded-xl border p-3 text-right transition-all", mode === "merge" ? "border-primary bg-secondary ring-2 ring-primary/20" : "border-border")}
            >
              <p className="text-sm font-bold">دمج</p>
              <p className="text-[11px] text-muted-foreground">بيضيف الأعمال اللي مش موجودة بس (بالـ ID) — آمن</p>
            </button>
            <button
              onClick={() => setMode("replace")}
              className={cn("rounded-xl border p-3 text-right transition-all", mode === "replace" ? "border-primary bg-secondary ring-2 ring-primary/20" : "border-border")}
            >
              <p className="text-sm font-bold">استرجاع كامل</p>
              <p className="text-[11px] text-muted-foreground">بيمسح كل الأعمال الحالية ويحط اللي في الملف</p>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full h-28 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 transition-colors flex flex-col items-center justify-center gap-2 text-primary disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
            <span className="text-sm font-bold">{busy ? "بيستورد…" : "دوس واختار ملف الـ JSON"}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// الشرح (بدل الجولة في البرنامج)
// ---------------------------------------------------------------------------
export function HelpDialog() {
  const open = useStore((s) => s.dialogs.helpOpen);
  const setDialog = useStore((s) => s.setDialog);
  if (!open) return null;
  const close = (): void => setDialog("helpOpen", false);

  const steps: Array<{ icon: React.ReactNode; title: string; text: string }> = [
    { icon: <Search className="w-5 h-5" />, title: "1) دوّر على العمل", text: "اكتب في خانة البحث فوق — قائمتك بتتفلتر فوراً، ونتايج النت (TMDB/TVmaze/iTunes/ويكيبيديا) بتظهر بعد ما توقف الكتابة لحظة. دوس «إضافة للقائمة»." },
    { icon: <ListChecks className="w-5 h-5" />, title: "2) افتح العمل من قائمتي", text: "كل عمل له حالة: جديد / معدّل / متصدّر، وشريط تقدم الحلقات. دوس على البطاقة تفتح الشاشة الكاملة." },
    { icon: <ClipboardPaste className="w-5 h-5" />, title: "3) زّق لينكات الحلقات", text: "«لصق لينكات كتير» بيفهم «حلقة 5 / EP05 / ح5 / #5» والأرقام العربي. سطر فاضي يفصل المجموعات، ومن غير أرقام التوزيع بالترتيب. كل لينك بيتحول تلقائي لصيغة embed." },
    { icon: <Server className="w-5 h-5" />, title: "4) السيرفرات", text: "جنب كل حلقة «السيرفرات»: إضافة/اسم/ترتيب/قفل/تجربة/فحص أونلاين. الأول = الأساسي وبيتصدّر الأول، والمقفول مش بيتصدّر." },
    { icon: <Globe className="w-5 h-5" />, title: "5) استخراج من موقع", text: "في شريط الموسم: زق رابط صفحة الموسم ودوس ابدأ — بيسحب الحلقات والسيرفرات، ومفيش حاجة بتتطبق غير لما تدوس «تطبيق على الموسم»." },
    { icon: <ImagePlus className="w-5 h-5" />, title: "6) الصور", text: "دوس على صورة العمل: بحث خارجي، رفع من جهازك (بتتخزن في مكتبة الموقع)، أو لينك مباشر. عشان صورة الجهاز تظهر في موقعك بعد الـ SQL حط «مسار رفع الصور» في الإعدادات." },
    { icon: <Sparkles className="w-5 h-5" />, title: "7) بيانات تلقائية", text: "«تحديث البيانات تلقائياً» بيجيب الوصف والسنة والأنواع والتقييم والصورة — بيوريك القديم والجديد قبل التطبيق، والفاضي بس بيتملّى، واللي عدلته بإيد مقفول." },
    { icon: <FileDown className="w-5 h-5" />, title: "8) صدّر SQL", text: "أدوات ← استخراج SQL: فحص قبل التصدير، «الجديد والمعدّل بس»، SQL Server أو MySQL، وبعد التصدير الأعمال بتعلّم «متصدّر». استورده في قاعدة vibehub." },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" /> الشرح — إزاي تستخدم «قائمتي» ويب
          </DialogTitle>
          <DialogDescription>كل حاجة يعملها البرنامج الأصلي موجودة هنا، وبياناتك محفوظة على الموقع تلقائياً.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-border p-3 bg-card">
              <span className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">{s.icon}</span>
              <div>
                <p className="text-sm font-bold">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-5 mt-0.5">{s.text}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-xs">
            <Download className="w-4 h-4 text-primary shrink-0" />
            عندك ملف من البرنامج الأصلي؟ أدوات ← استرجاع/دمج نسخة، واختار my_list_data.json وهيتستورد بحالته بالظبط (بما فيها حالات التصدير).
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { Work };
