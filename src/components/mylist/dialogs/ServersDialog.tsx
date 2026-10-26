"use client";
// نافذة "السيرفرات": إضافة/تعديل/حذف/ترتيب/قفل/تجربة/فحص/لصق — زي ServerManager في البرنامج
import { useEffect, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ChevronUp, ChevronDown, Play, ExternalLink, Loader2, ClipboardPaste, Globe2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { episodeServers, normalizeUrl, serverName, setEpisodeServers, validUrl } from "@/lib/mylist/urls";
import type { ServerT, Work } from "@/lib/mylist/types";

interface Row extends ServerT {
  key: string;
}

export function ServersDialog() {
  const dialog = useStore((s) => s.dialogs.servers);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const saveWork = useStore((s) => s.saveWork);
  const { toast } = useToast();
  const work = works.find((w) => w.id === dialog?.workId) || null;
  const season = work?.seasons.find((s) => s.number === dialog?.seasonNo) || null;
  const ep = season?.episodes.find((e) => e.number === dialog?.epNo) || null;

  const [rows, setRows] = useState<Row[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (dialog?.open && ep) {
      const svs = episodeServers(ep, true);
      setRows(svs.map((s, i) => ({ ...s, key: `k${i}` })));
    }
     
  }, [dialog?.open, dialog?.epNo]);

  if (!dialog) return null;
  const close = (): void => setDialog("servers", null);
  if (!work || !season || !ep) return <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}><DialogContent className="hidden" /></Dialog>;

  const title = `${work.title} — الموسم ${season.number} — حلقة ${ep.number}`;

  const persist = async (newRows: Row[]): Promise<void> => {
    const servers: ServerT[] = newRows.map((r) => {
      const s: ServerT = { name: r.name.trim(), url: r.url.trim() };
      if (r.enabled === false) s.enabled = false;
      return s;
    });
    setRows(newRows.map((r, i) => ({ ...r, key: `k${i}` })));
    const next: Work = JSON.parse(JSON.stringify(work));
    const sn = next.seasons.find((x) => x.number === season.number);
    const e2 = sn?.episodes.find((x) => x.number === ep.number);
    if (e2) setEpisodeServers(e2, servers);
    await saveWork(next);
  };

  const addRow = (): void => {
    void persist([...rows, { name: "", url: "", key: `new${Date.now()}`, enabled: true }]);
  };

  const move = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    void persist(next);
  };

  const tryAll = (): void => {
    const good = rows.filter((r) => r.enabled !== false && validUrl(normalizeUrl(r.url)));
    if (!good.length) {
      toast({ title: "مفيش سيرفر سليم للتجربة" });
      return;
    }
    if (good.length === 1) {
      window.open(normalizeUrl(good[0].url), "_blank", "noopener");
      return;
    }
    setDialog("preview", { open: true, title, servers: good.map((r) => ({ name: r.name || serverName(r.url), url: normalizeUrl(r.url), enabled: true })) });
  };

  const checkOnline = async (): Promise<void> => {
    const urls = rows.map((r) => normalizeUrl(r.url)).filter(Boolean);
    if (!urls.length) return;
    setTesting(true);
    try {
      const res = await fetch("/api/check-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = (await res.json()) as { results?: Array<{ status: string; msg: string }> };
      const results = data.results || [];
      const next = rows.map((r, i) => ({ ...r, check: results[i] }));
      setRows(next);
      const okCount = results.filter((r) => r.status === "ok").length;
      toast({ title: `فحص ${urls.length} لينك: ${okCount} سليم` });
    } catch {
      toast({ title: "فشل الفحص — مفيش نت؟", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>السيرفرات — {title}</DialogTitle>
          <DialogDescription>الأول في القائمة هو الأساسي وبيتصدّر الأول. المقفول مش بيتصدّر. اللينك بيتحوّل تلقائي لصيغة embed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={r.key} className={cn("rounded-xl border p-2.5 space-y-2 transition-colors", r.enabled === false ? "border-border bg-muted/40 opacity-70" : "border-border bg-card")}>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-secondary disabled:opacity-30" aria-label="لفوق">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-0.5 rounded hover:bg-secondary disabled:opacity-30" aria-label="لتحت">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={r.name}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...r, name: e.target.value };
                    setRows(next);
                  }}
                  onBlur={() => void persist(rows)}
                  placeholder={serverName(r.url) || "اسم السيرفر (اختياري)"}
                  className="h-9 w-36 shrink-0"
                  dir="auto"
                  aria-label="اسم السيرفر"
                />
                <Input
                  value={r.url}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...r, url: e.target.value };
                    setRows(next);
                  }}
                  onBlur={() => void persist(rows)}
                  placeholder="https://…"
                  className="h-9 flex-1"
                  dir="ltr"
                  aria-label="لينك السيرفر"
                />
                <Switch
                  checked={r.enabled !== false}
                  onCheckedChange={(v) => {
                    const next = [...rows];
                    next[i] = { ...r, enabled: v };
                    void persist(next);
                  }}
                  aria-label="تشغيل/قفل السيرفر"
                  title="قفل السيرفر من غير ما تمسحه (المقفول مش بيتصدّر)"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => void persist(rows.filter((_, k) => k !== i))}
                  aria-label="حذف السيرفر"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">الـ embed:</span>
                <code className="truncate bg-muted rounded px-1.5 py-0.5 flex-1" dir="ltr">
                  {normalizeUrl(r.url) || "—"}
                </code>
                <Button size="sm" variant="ghost" className="h-7 rounded-full px-2" onClick={() => normalizeUrl(r.url) && window.open(normalizeUrl(r.url), "_blank", "noopener")} disabled={!r.url}>
                  <ExternalLink className="w-3.5 h-3.5 me-1" /> فتح
                </Button>
                {r.check && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold", r.check.status === "ok" ? "bg-teal-100 text-teal-700" : r.check.status === "warn" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                    {r.check.status === "ok" ? <CheckCircle2 className="w-3 h-3" /> : r.check.status === "warn" ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {r.check.msg.slice(0, 40)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">مفيش سيرفرات — دوس «إضافة سيرفر» أو الصق لينكات.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" className="rounded-full" onClick={addRow}>
            <Plus className="w-3.5 h-3.5 me-1" /> إضافة سيرفر
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                const urls = (text.match(/https?:\/\/[^\s"'<>]+/gi) || []).filter(Boolean);
                if (!urls.length) {
                  toast({ title: "مفيش لينكات في الحافظة" });
                  return;
                }
                void persist([...rows, ...urls.map((u) => ({ url: u, name: "", key: `p${Math.random()}`, enabled: true }))]);
                toast({ title: `اتضاف ${urls.length} لينك` });
              } catch {
                toast({ title: "مقدرتش أقرا الحافظة — الصق في خانة اللينك بإيدك" });
              }
            }}
          >
            <ClipboardPaste className="w-3.5 h-3.5 me-1" /> لصق من الحافظة
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={tryAll}>
            <Play className="w-3.5 h-3.5 me-1" /> تجربة
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => void checkOnline()} disabled={testing}>
            {testing ? <Loader2 className="w-3.5 h-3.5 me-1 animate-spin" /> : <Globe2 className="w-3.5 h-3.5 me-1" />} فحص أونلاين
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
