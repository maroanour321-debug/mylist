"use client";
// نافذة "الإعدادات": مفتاح TMDB + نوع القاعدة + اسم القاعدة + الـ Schema + مسار رفع الصور + البيانات التلقائية
import { useEffect, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { MySettings } from "@/lib/mylist/types";

export function SettingsDialog() {
  const open = useStore((s) => s.dialogs.settingsOpen);
  const setDialog = useStore((s) => s.setDialog);
  const settings = useStore((s) => s.settings);
  const saveSettings = useStore((s) => s.saveSettings);
  const { toast } = useToast();
  const [form, setForm] = useState<MySettings>(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  if (!open) return null;
  const close = (): void => setDialog("settingsOpen", false);

  const ok = async (): Promise<void> => {
    setBusy(true);
    try {
      await saveSettings(form);
      toast({ title: "اتحفظت الإعدادات" });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>الإعدادات</DialogTitle>
          <DialogDescription>بتتحفظ على السيرفر وبتتستخدم في البحث والتصدير.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>مفتاح TMDB (مجاني)</Label>
            <Input value={form.tmdb_key} onChange={(e) => setForm({ ...form, tmdb_key: e.target.value })} placeholder="من themoviedb.org ← Settings ← API" dir="ltr" />
            <p className="text-[11px] text-muted-foreground">من غير مفتاح البحث شغال (TVmaze / iTunes / ويكيبيديا)، ومع المفتاح النتايج بتبقى أدق وبالعربي.</p>
          </div>

          <div className="space-y-1.5">
            <Label>نوع قاعدة البيانات في الاستخراج</Label>
            <div className="flex rounded-xl border border-input overflow-hidden">
              {([
                ["mssql", "SQL Server (SSMS)"],
                ["mysql", "MySQL (phpMyAdmin)"],
              ] as const).map(([v, label]) => (
                <button key={v} className={cn("flex-1 py-2 text-sm font-bold", form.dialect === v ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => setForm({ ...form, dialect: v })}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>اسم القاعدة (vibehub)</Label>
              <Input value={form.db_name} onChange={(e) => setForm({ ...form, db_name: e.target.value })} placeholder="vibehub" dir="ltr" />
              <p className="text-[11px] text-muted-foreground">فاضي = الملف من غير USE</p>
            </div>
            <div className="space-y-1.5">
              <Label>الـ Schema</Label>
              <Input value={form.schema} onChange={(e) => setForm({ ...form, schema: e.target.value })} placeholder="dbo" dir="ltr" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>مسار رفع الصور المحلية</Label>
            <Input value={form.image_url_prefix} onChange={(e) => setForm({ ...form, image_url_prefix: e.target.value })} placeholder="/uploads/posters/" dir="ltr" />
            <p className="text-[11px] text-muted-foreground">
              الصور اللي بتختارها من جهازك بتتخزن في مكتبة الموقع. عشان تظهر في الموقع بعد الـ SQL اكتب المسار اللي بترفع عليه الصور (مثلاً /uploads/posters/) — لو فاضي الصورة المحلية مش هتتصدّر.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-bold">جيب بيانات العمل تلقائياً</p>
              <p className="text-[11px] text-muted-foreground">الوصف والسنة والصورة… الفاضي بس بيتملى، والمعدّل بإيدك مش بيتلمس.</p>
            </div>
            <Switch checked={form.auto_metadata} onCheckedChange={(v) => setForm({ ...form, auto_metadata: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button onClick={() => void ok()} disabled={busy} className="rounded-full px-6">
            {busy && <Loader2 className="w-4 h-4 me-1 animate-spin" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
