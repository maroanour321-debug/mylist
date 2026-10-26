"use client";
// نافذة "فحص اللينكات أونلاين": كل لينكات العمل (أو لينك مالي) — ok/warn/dead
import { useEffect, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Globe2, Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { episodeServers, normalizeUrl, serverLabel } from "@/lib/mylist/urls";
import { seasonName } from "@/lib/mylist/sqlbuilder";
import type { Work } from "@/lib/mylist/types";

interface CheckResult {
  status: "ok" | "warn" | "dead";
  msg: string;
}

interface Item {
  tag: string;
  url: string;
}

export function CheckLinksDialog() {
  const dialog = useStore((s) => s.dialogs.checkLinks);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const { toast } = useToast();
  const work = dialog?.workId ? works.find((w) => w.id === dialog.workId) || null : null;
  const [items, setItems] = useState<Item[]>([]);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (dialog?.open) {
      setResults([]);
      if (work) {
        const list: Item[] = [];
        const isMovie = work.type === "movie";
        for (const s of work.seasons) {
          for (const e of s.episodes) {
            const tag = isMovie ? "الفيلم" : `${seasonName(s.number)} - حلقة ${e.number}`;
            for (const sv of episodeServers(e)) {
              list.push({ tag, url: sv.url });
            }
          }
        }
        setItems(list);
      } else setItems([]);
    }
     
  }, [dialog?.open]);

  if (!dialog) return null;
  const close = (): void => setDialog("checkLinks", null);

  const run = async (): Promise<void> => {
    if (!items.length) {
      toast({ title: "مفيش لينكات للفحص" });
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const res = await fetch("/api/check-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: items.map((i) => i.url) }),
      });
      const data = (await res.json()) as { results?: CheckResult[] };
      setResults(data.results || []);
      const ok = (data.results || []).filter((r) => r.status === "ok").length;
      const warn = (data.results || []).filter((r) => r.status === "warn").length;
      const dead = (data.results || []).filter((r) => r.status === "dead").length;
      toast({ title: `فحص ${items.length} لينك`, description: `سليم: ${ok} · مشكوك: ${warn} · ميّت: ${dead}` });
    } catch {
      toast({ title: "فشل الفحص — مفيش نت؟", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const cnt = { ok: 0, warn: 0, dead: 0 };
  for (const r of results) cnt[r.status] += 1;

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>فحص اللينكات أونلاين {work ? `— ${work.title}` : ""}</DialogTitle>
          <DialogDescription>
            الرد السليم معناه إن الصفحة بتفتح، مش دايماً إن الفيديو نفسه لسه موجود. الرد بـ 401/403 معناه إن الموقع بيمنع الفحص الآلي — جرّبه بإيدك بزرار ▶.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button onClick={() => void run()} disabled={running || !items.length} className="rounded-full">
            {running ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Globe2 className="w-4 h-4 me-1" />} فحص {items.length} لينك
          </Button>
          {results.length > 0 && (
            <span className="text-xs font-bold flex items-center gap-2">
              <span className="text-teal-600">سليم {cnt.ok}</span>·<span className="text-amber-600">مشكوك {cnt.warn}</span>·<span className="text-red-600">ميّت {cnt.dead}</span>
            </span>
          )}
        </div>

        {running && <Progress value={results.length ? (results.length / items.length) * 100 : 10} className="h-1.5" />}

        <div className="rounded-xl border border-border divide-y divide-border/50 max-h-80 overflow-y-auto text-xs">
          {items.map((it, i) => {
            const r = results[i];
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <span className="w-32 shrink-0 truncate font-bold text-muted-foreground" title={it.tag}>
                  {it.tag}
                </span>
                <code className="flex-1 truncate text-[10px]" dir="ltr" title={it.url}>
                  {it.url}
                </code>
                {r ? (
                  <>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold shrink-0",
                        r.status === "ok" ? "bg-teal-100 text-teal-700" : r.status === "warn" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {r.status === "ok" ? <CheckCircle2 className="w-3 h-3" /> : r.status === "warn" ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {r.msg.slice(0, 30)}
                    </span>
                    <button onClick={() => window.open(normalizeUrl(it.url), "_blank", "noopener")} className="shrink-0 text-muted-foreground hover:text-primary" title="فتح">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground shrink-0">{running ? "…" : ""}</span>
                )}
              </div>
            );
          })}
          {!items.length && <p className="p-6 text-center text-muted-foreground">{work ? "العمل ده مفيهوش لينكات لسه." : "افتح عمل من قائمتك وافحص لينكاته من هنا."}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function serverLabelOf(url: string): string {
  return serverLabel({ url, name: "" });
}
