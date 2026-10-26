"use client";
// نافذة "استخراج من موقع": رابط صفحة الموسم → سحب الحلقات والسيرفرات → تطبيق على الموسم
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Play, Square, Download, Copy, CheckCheck, Loader2, Globe } from "lucide-react";
import { seasonName } from "@/lib/mylist/sqlbuilder";
import { isSeriesCat } from "@/lib/mylist/logic";
import type { ScrapeResult, Work } from "@/lib/mylist/types";

interface LogLine {
  kind: "info" | "ok" | "warn" | "error";
  msg: string;
  current: number;
  total: number;
}

const LOG_COLOR: Record<LogLine["kind"], string> = {
  info: "text-cyan-700",
  ok: "text-teal-600",
  warn: "text-amber-600",
  error: "text-red-600",
};

export function ScrapeDialog() {
  const dialog = useStore((s) => s.dialogs.scrape);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const saveWork = useStore((s) => s.saveWork);
  const { toast } = useToast();
  const work = works.find((w) => w.id === dialog?.workId) || null;
  const season = work?.seasons.find((s) => s.number === dialog?.seasonNo) || null;

  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ScrapeResult[] | null>(null);
  const [replace, setReplace] = useState(false);
  const [useTitles, setUseTitles] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dialog?.open && season) {
      setUrl(season.sourceUrl || "");
      setLog([]);
      setResults(null);
      setError("");
      setRunning(false);
    }
  }, [dialog?.open, season]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  if (!dialog) return null;
  const close = (): void => setDialog("scrape", null);
  if (!work || !season) return <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}><DialogContent className="hidden" /></Dialog>;

  const title = `${work.title} — ${isSeriesCat(work.category) ? seasonName(season.number) : "الفيلم"}`;

  const start = async (): Promise<void> => {
    const clean = url.trim();
    if (!clean || clean.includes(" ")) {
      toast({ title: "الرابط مش صحيح" });
      return;
    }
    const full = /^https?:\/\//i.test(clean) ? clean : "https://" + clean;
    setRunning(true);
    setLog([{ kind: "info", msg: `بتصل بالصفحة: ${full}`, current: 0, total: 0 }]);
    setResults(null);
    setError("");
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: full }),
      });
      const data = (await res.json()) as { results?: ScrapeResult[]; log?: LogLine[]; error?: string; cancelled?: boolean };
      if (data.log) {
        setLog(data.log);
        const last = data.log[data.log.length - 1];
        if (last) setProgress({ current: last.current, total: last.total });
      }
      if (data.error) setError(data.error);
      if (data.results) {
        setResults(data.results);
        const withServers = data.results.filter((r) => r.servers.length).length;
        toast({ title: `خلص الاستخراج: ${data.results.length} حلقة (${withServers} فيها سيرفرات)` });
      }
    } catch {
      setError("تعذّر الوصول لسيرفر الموقع — جرّب تاني");
    } finally {
      setRunning(false);
    }
  };

  const apply = async (): Promise<void> => {
    if (!results) return;
    if (replace) {
      const confirmed = window.confirm("هتبدّل سيرفرات الحلقات الموجودة بالمستخرج. متأكد؟");
      if (!confirmed) return;
    }
    // استيراد منطق التطبيق من نسخة السيرفر (نفس apply_to_season)
    const { applyToSeason } = await import("@/lib/mylist/server/scraper");
    const next = JSON.parse(JSON.stringify(work)) as Work;
    const sn = next.seasons.find((x) => x.number === season.number);
    if (!sn) return;
    const stat = applyToSeason(sn, results, replace, useTitles);
    sn.sourceUrl = url.trim();
    const saved = await saveWork(next);
    if (saved) {
      toast({
        title: "اتطبق على الموسم",
        description: `${stat.episodes} حلقة اتعدلت · ${stat.created} جديدة · ${stat.serversAdded} سيرفر اتضاف${stat.titles ? ` · ${stat.titles} اسم` : ""}`,
      });
      close();
    } else toast({ title: "فشل الحفظ", variant: "destructive" });
  };

  const saveJson = (): void => {
    if (!results) return;
    const json = JSON.stringify(
      results.map((r) => ({ episode_number: r.episode_number, title: r.title, servers: r.servers })),
      null,
      4
    );
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${work.title.replace(/[\\/:*?"<>|\s]+/g, "_").toLowerCase().replace(/^_+|_+$/g, "") || "episodes"}_season_${season.number}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const lastWithTotal = [...log].reverse().find((l) => l.total > 0);

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>استخراج من موقع — {title}</DialogTitle>
          <DialogDescription>
            الرابط بتاع صفحة الموسم (اللي فيها لينكات الحلقات). البرنامج بيدخل صفحة مشاهدة كل حلقة ويسحب الـ iframes وعناصر السيرفرات. مفيش حاجة بتتغير في عملك غير لما تدوس «تطبيق على الموسم».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>رابط صفحة الموسم</Label>
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/series/season-2" dir="ltr" className="flex-1" disabled={running} />
              {running ? (
                <Button variant="destructive" className="rounded-full shrink-0" onClick={() => setRunning(false)} title="إيقاف (الطلب بيكمل في الخلفية بس مش هيتطبق حاجة)">
                  <Square className="w-4 h-4 me-1" /> إيقاف
                </Button>
              ) : (
                <Button className="rounded-full shrink-0" onClick={() => void start()}>
                  <Play className="w-4 h-4 me-1" /> ابدأ الاستخراج
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">الرابط بيتحفظ على الموسم — المرة الجاية هتلاقيه مكتوب وتدوس ابدأ بس.</p>
          </div>

          {(running || log.length > 0) && (
            <div className="space-y-2">
              {lastWithTotal && (
                <div className="flex items-center gap-3">
                  <Progress value={lastWithTotal.total ? (lastWithTotal.current / lastWithTotal.total) * 100 : 0} className="h-2 flex-1" />
                  <span className="text-xs font-bold whitespace-nowrap">
                    {lastWithTotal.current}/{lastWithTotal.total}
                  </span>
                </div>
              )}
              <div ref={logRef} className="rounded-xl border border-border bg-card p-3 h-44 overflow-y-auto font-mono text-[11px] leading-5 space-y-0.5" dir="rtl">
                {log.map((l, i) => (
                  <p key={i} className={cn(LOG_COLOR[l.kind])}>
                    {l.msg}
                  </p>
                ))}
                {running && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> بيشتغل…
                  </p>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive bg-red-50 rounded-xl px-3 py-2">❌ {error}</p>}

          {results && (
            <div className="space-y-3 ml-fade-up">
              <div className="flex items-center gap-2 text-sm font-bold text-teal-700">
                <CheckCheck className="w-4 h-4" /> النتايج: {results.length} حلقة، {results.reduce((a, r) => a + r.servers.length, 0)} سيرفر
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border/50 text-xs">
                {results.map((r) => (
                  <div key={r.episode_number} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-8 font-bold text-primary">{r.episode_number}</span>
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className={cn("font-bold", r.servers.length ? "text-teal-600" : "text-muted-foreground")}>{r.servers.length} سيرفر</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={replace} onCheckedChange={(v) => setReplace(Boolean(v))} />
                  بدّل سيرفرات الحلقات الموجودة (بيسألك الأول)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={useTitles} onCheckedChange={(v) => setUseTitles(Boolean(v))} />
                  أسماء الحلقات المميزة (بس للفاضي)
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void apply()} className="rounded-full">
                  <Globe className="w-4 h-4 me-1" /> تطبيق على الموسم
                </Button>
                <Button variant="outline" className="rounded-full" onClick={saveJson}>
                  <Download className="w-4 h-4 me-1" /> حفظ JSON…
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    if (!results) return;
                    void navigator.clipboard.writeText(JSON.stringify(results.map((r) => ({ episode_number: r.episode_number, title: r.title, servers: r.servers })), null, 4));
                    toast({ title: "اتنسخ الـ JSON" });
                  }}
                >
                  <Copy className="w-4 h-4 me-1" /> نسخ JSON
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
