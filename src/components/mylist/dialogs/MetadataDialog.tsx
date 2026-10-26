"use client";
// نافذة "تحديث البيانات تلقائياً": مراجعة القديم والجديد قبل التطبيق (زي MetaPreview)
import { useEffect, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2 } from "lucide-react";
import { metadataChanges, applyMetadata, applyEpisodeTitles } from "@/lib/mylist/logic";
import type { SeasonT, Work } from "@/lib/mylist/types";

interface MetaResult {
  found: boolean;
  source: string;
  matched: string;
  fields: Record<string, string>;
  seasons?: SeasonT[];
}

export function MetadataDialog() {
  const dialog = useStore((s) => s.dialogs.metadata);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const saveWork = useStore((s) => s.saveWork);
  const { toast } = useToast();
  const work = works.find((w) => w.id === dialog?.workId) || null;
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const rows = work && dialog ? metadataChanges(work, dialog.result.fields) : [];

  useEffect(() => {
    if (dialog?.open && work) {
      // الافتراضي: الحقول الفاضية بس هيتملى (fill) — زي البرنامج
      const init: Record<string, boolean> = {};
      for (const row of metadataChanges(work, dialog.result.fields)) {
        if (row.status === "fill") init[row.key] = true;
      }
      setChecks(init);
    }
     
  }, [dialog?.open]);

  if (!dialog) return null;
  const close = (): void => setDialog("metadata", null);
  if (!work) return <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}><DialogContent className="hidden" /></Dialog>;

  const ok = async (): Promise<void> => {
    const next = JSON.parse(JSON.stringify(work)) as Work;
    const force = Object.entries(checks).filter(([, v]) => v).map(([k]) => k);
    const changed = applyMetadata(next, dialog.result.fields, force);
    let titles = 0;
    if (dialog.result.seasons?.length) titles = applyEpisodeTitles(next, dialog.result.seasons);
    const saved = await saveWork(next);
    if (saved) {
      toast({ title: `اتحدثت ${changed.length} حقل`, description: titles ? `وكمان اتملت ${titles} اسم حلقة فاضي` : undefined });
    } else toast({ title: "فشل الحفظ", variant: "destructive" });
    close();
  };

  const statusStyle: Record<string, string> = {
    fill: "text-teal-700 bg-teal-50",
    same: "text-muted-foreground bg-muted",
    conflict: "text-amber-700 bg-amber-50",
    locked: "text-slate-500 bg-slate-100",
  };
  const statusLabel: Record<string, string> = { fill: "هيتملى", same: "متطابق", conflict: "مختلف", locked: "مقفول (عدّلته بإيدك)" };

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> تحديث البيانات تلقائياً
          </DialogTitle>
          <DialogDescription>
            {dialog.result.found ? (
              <>
                المصدر: <b>{dialog.result.source || "؟"}</b> — {dialog.result.matched}. الفاضي بس بيتعلّم، وأي قيمة موجودة مش بتتبدّل غير لو علّمت عليها بنفسك.
              </>
            ) : (
              "المصادر معندهاش حاجة عن العمل ده."
            )}
          </DialogDescription>
        </DialogHeader>

        {dialog.result.found && (
          <div className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
            {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">مفيش أي حقل جديد من المصدر.</p>}
            {rows.map((row) => (
              <div key={row.key} className="p-3 flex items-start gap-3">
                {row.status !== "same" && row.status !== "locked" ? (
                  <Checkbox checked={Boolean(checks[row.key])} onCheckedChange={(v) => setChecks((c) => ({ ...c, [row.key]: Boolean(v) }))} className="mt-1" aria-label={`تطبيق ${row.label}`} />
                ) : (
                  <span className="w-5" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{row.label}</span>
                    <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-bold", statusStyle[row.status])}>{statusLabel[row.status]}</span>
                  </div>
                  {row.status === "conflict" && (
                    <p className="text-xs text-muted-foreground line-through truncate" title={row.old}>
                      القديم: {row.old || "—"}
                    </p>
                  )}
                  <p className={cn("text-xs truncate", row.status === "same" ? "text-muted-foreground" : "text-foreground")} title={row.new}>
                    {row.status === "conflict" ? "الجديد: " : ""}
                    {row.new}
                  </p>
                  {row.key === "poster" && row.new.startsWith("http") && (
                     
                    <img src={row.new} alt="معاينة الصورة" className="w-16 rounded-lg border border-border mt-1" referrerPolicy="no-referrer" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button onClick={() => void ok()} className="rounded-full px-6" disabled={!dialog.result.found}>
            {useStore.getState().saving && <Loader2 className="w-4 h-4 me-1 animate-spin" />} تطبيق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
