"use client";
// شاشة العمل المفتوح: الهيدر (بوستر + بيانات) + تبويبات المواسم + جدول الحلقات والسيرفرات
import { useMemo, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { PosterImg, CatBadge, StateBadge } from "./common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowRight, ImagePlus, Pencil, Sparkles, Play, ClipboardPaste, Globe, Plus, Trash2,
  Server, ChevronDown, RefreshCw, Loader2, ClipboardList, Link2, FileJson,
} from "lucide-react";
import { stateOf, workProgress, isSeriesCat } from "@/lib/mylist/logic";
import { episodeServers, serverLabel, serversSummary, setEpisodeServers, newEpisode, episodeLinks, episodeRawServers } from "@/lib/mylist/urls";
import { fillSmart } from "@/lib/mylist/text";
import { seasonName } from "@/lib/mylist/sqlbuilder";
import type { Work, SeasonT, EpisodeT } from "@/lib/mylist/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkView({ workId }: { workId: string }) {
  const works = useStore((s) => s.works);
  const openWork = useStore((s) => s.openWork);
  const setDialog = useStore((s) => s.setDialog);
  const saveWork = useStore((s) => s.saveWork);
  const saving = useStore((s) => s.saving);
  const { toast } = useToast();
  const work = useMemo(() => works.find((w) => w.id === workId) || null, [works, workId]);
  const [seasonNo, setSeasonNo] = useState<number>(work?.seasons[0]?.number ?? 1);

  if (!work) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        العمل مش موجود في القائمة.
        <Button variant="link" onClick={() => openWork(null)}>
          رجوع لقائمتي
        </Button>
      </div>
    );
  }

  const state = stateOf(work);
  const { filled, total } = workProgress(work);
  const season = work.seasons.find((s) => s.number === seasonNo) || work.seasons[0];

  const update = async (mutate: (w: Work) => void, msg?: string): Promise<void> => {
    const next: Work = JSON.parse(JSON.stringify(work));
    mutate(next);
    const ok = await saveWork(next);
    if (msg) toast({ title: ok ? msg : "فشل الحفظ", variant: ok ? undefined : "destructive" });
  };

  const addSeason = (): void => {
    void update((w) => {
      const n = Math.max(0, ...w.seasons.map((s) => s.number)) + 1;
      w.seasons.push({ number: n, episodes: [newEpisode(1)] });
      setSeasonNo(n);
    }, `اتضاف الموسم ${Math.max(0, ...work.seasons.map((s) => s.number)) + 1}`);
  };

  const deleteSeason = (n: number): void => {
    if (work.seasons.length <= 1) {
      toast({ title: "لازم يفضل موسم واحد على الأقل" });
      return;
    }
    void update((w) => {
      w.seasons = w.seasons.filter((s) => s.number !== n);
      if (!w.seasons.some((s) => s.number === seasonNo)) setSeasonNo(w.seasons[0].number);
    }, "اتمسح الموسم");
  };

  const addEpisode = (): void => {
    if (!season) return;
    void update((w) => {
      const s = w.seasons.find((x) => x.number === season.number);
      if (!s) return;
      const n = Math.max(0, ...s.episodes.map((e) => e.number)) + 1;
      s.episodes.push(newEpisode(n));
    }, `اتضاف حلقة ${Math.max(0, ...(season?.episodes.map((e) => e.number) || [0])) + 1}`);
  };

  const tryEpisode = (ep: EpisodeT): void => {
    const servers = episodeServers(ep).filter((s) => s.url);
    if (!servers.length) {
      toast({ title: "الحلقة دي مفيهاش لينكات لسه" });
      return;
    }
    if (servers.length === 1) {
      window.open(servers[0].url, "_blank", "noopener");
      return;
    }
    setDialog("preview", {
      open: true,
      title: `${work.title} — ${season ? seasonName(season.number) : ""} حلقة ${ep.number}`,
      servers: servers.map((s) => ({ name: serverLabel(s), url: s.url, enabled: s.enabled !== false })),
    });
  };

  const smartPaste = (season: SeasonT, text: string): void => {
    void update((w) => {
      const s = w.seasons.find((x) => x.number === season.number);
      if (!s) return;
      const { filled: n, numbered } = fillSmart(s, text);
      toast({
        title: `اتملت ${n} ${numbered ? "(بالأرقام)" : "(بالترتيب)"}`,
        description: n === 0 ? "مفيش لينكات في اللي لزيقته" : undefined,
      });
    });
  };

  const fetchMeta = async (): Promise<void> => {
    toast({ title: "بيجيب البيانات من المصادر…" });
    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: { title: work.title, year: work.year, type: work.type, category: work.category }, wantSeasons: true }),
      });
      const meta = (await res.json()) as { found: boolean; source: string; matched: string; fields: Record<string, string>; seasons?: SeasonT[]; error?: string };
      if (meta.error && !meta.found) {
        toast({ title: "تعذّر جلب البيانات", description: meta.error, variant: "destructive" });
        return;
      }
      if (!meta.found) {
        toast({ title: "المصادر معندهاش حاجة عن العمل ده" });
        return;
      }
      setDialog("metadata", { open: true, workId: work.id, result: meta });
    } catch {
      toast({ title: "تعذّر الوصول للنت", variant: "destructive" });
    }
  };

  return (
    <div className="pt-4 ml-fade-up">
      {/* زرار الرجوع */}
      <Button variant="ghost" onClick={() => openWork(null)} className="rounded-full mb-3 -ms-2">
        <ArrowRight className="w-4 h-4 me-1" /> رجوع لقائمتي
      </Button>

      {/* هيدر العمل */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="relative w-36 sm:w-44 shrink-0">
          <div className="rounded-2xl overflow-hidden shadow-lg ring-1 ring-border">
            <PosterImg
              src={work.poster ? work.poster : work.posterLocal ? `/api/images/file/${work.posterLocal.replace(/^images\//, "")}` : undefined}
              title={work.title}
              className="aspect-[2/3] w-full"
            />
          </div>
          <button
            onClick={() => setDialog("imagePicker", { open: true, workId: work.id, field: "poster" })}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs font-bold py-3 hover:from-teal-900/90 transition-colors"
            aria-label="تغيير الصورة"
          >
            <span className="inline-flex items-center gap-1">
              <ImagePlus className="w-3.5 h-3.5" /> تغيير الصورة
            </span>
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CatBadge category={work.category} />
            <StateBadge state={state} />
            {work.hub && <span className="text-[11px] rounded-full bg-secondary px-2 py-0.5 font-bold text-secondary-foreground">هب: {work.hub}</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{work.title}</h1>
          {work.altTitle && <p className="text-sm text-muted-foreground">{work.altTitle}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {work.year && <span>سنة: {work.year}</span>}
            {work.rating && <span className="text-amber-600 font-bold">★ {work.rating}</span>}
            {work.studio && <span>{work.studio}</span>}
            {work.genres && <span>{work.genres.split(",").join(" · ")}</span>}
            {work.classification && <span className="rounded bg-secondary px-1.5">{work.classification}</span>}
          </div>
          {work.overview && <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">{work.overview}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDialog("details", { open: true, workId: work.id })}>
              <Pencil className="w-3.5 h-3.5 me-1" /> بيانات العمل
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => void fetchMeta()}>
              <Sparkles className="w-3.5 h-3.5 me-1" /> تحديث البيانات تلقائياً
            </Button>
            {work.type === "movie" && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const servers = work.seasons.flatMap((s) => s.episodes.flatMap((e) => episodeServers(e)));
                  if (!servers.length) {
                    toast({ title: "الفيلم مفيهوش لينكات لسه" });
                    return;
                  }
                  if (servers.length === 1) window.open(servers[0].url, "_blank", "noopener");
                  else
                    setDialog("preview", { open: true, title: work.title, servers: servers.map((s) => ({ name: serverLabel(s), url: s.url, enabled: s.enabled !== false })) });
                }}
              >
                <Play className="w-3.5 h-3.5 me-1" /> تجربة
              </Button>
            )}
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDialog("checkLinks", { open: true, workId: work.id })}>
              <ClipboardList className="w-3.5 h-3.5 me-1" /> فحص اللينكات
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const json = JSON.stringify(
                  work.seasons.map((s) => ({ number: s.number, episodes: s.episodes.map((e) => ({ number: e.number, title: e.title, servers: episodeServers(e, true) })) })),
                  null,
                  2
                );
                void navigator.clipboard?.writeText(json);
                toast({ title: "اتنسخ JSON للحلقات" });
              }}
            >
              <FileJson className="w-3.5 h-3.5 me-1" /> نسخ JSON
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5 me-1" /> حذف
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تحب تحذف «{work.title}»؟</AlertDialogTitle>
                  <AlertDialogDescription>الحذف من الموقع بيشيل العمل من قائمتك بس، ومبيمسحوش من قاعدة البيانات اللي صدّرت لها قبل كده.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>سيبه</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={async () => {
                      await useStore.getState().deleteWork(work.id);
                      openWork(null);
                    }}
                  >
                    احذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {saving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>

          <div className="flex items-center gap-3 pt-1 max-w-md">
            <Progress value={total ? (filled / total) * 100 : 0} className="h-2" />
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              {filled}/{total} حلقة بلينك
            </span>
          </div>
        </div>
      </div>

      {/* شريط المواسم */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Tabs value={String(season?.number ?? 1)} onValueChange={(v) => setSeasonNo(Number(v))}>
          <TabsList className="rounded-full bg-secondary/70 p-1">
            {work.seasons.map((s) => (
              <TabsTrigger key={s.number} value={String(s.number)} className="rounded-full text-sm">
                {isSeriesCat(work.category) ? seasonName(s.number) : "الفيلم"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {isSeriesCat(work.category) && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={addSeason}>
            <Plus className="w-3.5 h-3.5 me-1" /> إضافة موسم
          </Button>
        )}
        {season && (
          <>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDialog("paste", { open: true, workId: work.id, seasonNo: season.number, epNo: null })}>
              <ClipboardPaste className="w-3.5 h-3.5 me-1" /> لصق لينكات كتير
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDialog("scrape", { open: true, workId: work.id, seasonNo: season.number })}>
              <Globe className="w-3.5 h-3.5 me-1" /> استخراج من موقع
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={() => deleteSeason(season.number)}>
              <Trash2 className="w-3.5 h-3.5 me-1" /> مسح الموسم
            </Button>
          </>
        )}
      </div>

      {/* جدول الحلقات */}
      {season && (
        <EpisodesTable work={work} season={season} onTry={tryEpisode} onSmartPaste={smartPaste} update={update} />
      )}
    </div>
  );
}

function EpisodesTable({
  work,
  season,
  onTry,
  onSmartPaste,
  update,
}: {
  work: Work;
  season: SeasonT;
  onTry: (ep: EpisodeT) => void;
  onSmartPaste: (season: SeasonT, text: string) => void;
  update: (mutate: (w: Work) => void, msg?: string) => Promise<void>;
}) {
  const setDialog = useStore((s) => s.setDialog);
  const { toast } = useToast();
  const [quickPaste, setQuickPaste] = useState(false);
  const [quickText, setQuickText] = useState("");

  const setEpTitle = (epNo: number, title: string): void => {
    void update((w) => {
      const s = w.seasons.find((x) => x.number === season.number);
      const ep = s?.episodes.find((e) => e.number === epNo);
      if (ep) ep.title = title;
    });
  };

  const deleteEpisode = (epNo: number): void => {
    void update((w) => {
      const s = w.seasons.find((x) => x.number === season.number);
      if (s) s.episodes = s.episodes.filter((e) => e.number !== epNo);
    }, "اتمسحت الحلقة");
  };

  const appendToEpisode = (epNo: number, text: string): void => {
    void update((w) => {
      const s = w.seasons.find((x) => x.number === season.number);
      const ep = s?.episodes.find((e) => e.number === epNo);
      if (!ep) return;
      const urls = (text.match(/https?:\/\/[^\s"'<>]+/gi) || []).filter(Boolean);
      if (!urls.length) return;
      const existing = new Set(episodeServers(ep, true).map((x) => x.url));
      const merged = [...episodeRawServers(ep), ...urls.filter((u) => !existing.has(u)).map((u) => ({ url: u, name: "" }))];
      setEpisodeServers(ep, merged);
      toast({ title: `اتضاف ${urls.length} لينك للحلقة ${epNo}` });
    });
  };

  return (
    <div className="mt-4 rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/50 border-b border-border/60">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Link2 className="w-4 h-4 text-primary" />
          {isSeriesCat(work.category) ? seasonName(season.number) : "لينكات الفيلم"}
          <span className="text-xs font-normal text-muted-foreground">({season.episodes.length} حلقة)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="rounded-full h-8" onClick={() => setQuickPaste((v) => !v)}>
            <RefreshCw className="w-3.5 h-3.5 me-1" /> لصق سريع
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => void update((w) => {
            const s = w.seasons.find((x) => x.number === season.number);
            if (!s) return;
            const n = Math.max(0, ...s.episodes.map((e) => e.number)) + 1;
            s.episodes.push(newEpisode(n));
          }, "اتضاف حلقة جديدة")}>
            <Plus className="w-3.5 h-3.5 me-1" /> حلقة
          </Button>
        </div>
      </div>

      {quickPaste && (
        <div className="p-3 bg-background border-b border-border/60 space-y-2 ml-fade-up">
          <textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            rows={4}
            dir="auto"
            placeholder={"زق اللينكات هنا…\nحلقة 5\nhttps://…\nhttps://…\n\nسطر فاضي يفصل الحلقات، ومفيش أرقام = توزيع بالترتيب"}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-inner focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setQuickText(""); setQuickPaste(false); }}>
              إلغاء
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => { onSmartPaste(season, quickText); setQuickText(""); setQuickPaste(false); }}>
              <ClipboardPaste className="w-3.5 h-3.5 me-1" /> توزيع على الحلقات
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border/50">
        {[...season.episodes].sort((a, b) => a.number - b.number).map((ep) => {
          const svs = episodeServers(ep, true);
          return (
            <div key={ep.number} className="group px-3 sm:px-4 py-2.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-secondary flex items-center justify-center text-sm font-extrabold text-primary">
                  {ep.number}
                </span>
                <div className="flex-1 min-w-0">
                  <Input
                    value={ep.title}
                    onChange={(e) => setEpTitle(ep.number, e.target.value)}
                    placeholder={`حلقة ${ep.number}`}
                    className="h-8 bg-transparent border-transparent hover:border-input px-2 font-bold text-sm shadow-none"
                    aria-label={`اسم الحلقة ${ep.number}`}
                  />
                  <p className="text-[11px] text-muted-foreground px-2 truncate" title={serversSummary(ep)}>
                    {serversSummary(ep)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-full h-8 px-2.5" onClick={() => setDialog("servers", { open: true, workId: work.id, seasonNo: season.number, epNo: ep.number })}>
                    <Server className="w-3.5 h-3.5 sm:me-1" />
                    <span className="hidden sm:inline">السيرفرات</span>
                    {svs.length > 0 && <span className="ms-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">{svs.length}</span>}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full h-8 px-2.5" title="لصق لينكات على الحلقة (بيضيف مش بيمسح)" onClick={() => setDialog("paste", { open: true, workId: work.id, seasonNo: season.number, epNo: ep.number })}>
                    <ClipboardPaste className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full h-8 px-2.5" title="تجربة" onClick={() => onTry(ep)} disabled={!episodeLinks(ep).length}>
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="rounded-full h-8 px-1.5" aria-label="أكتر">
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteEpisode(ep.number)}>
                        <Trash2 className="w-4 h-4 me-2" /> حذف الحلقة
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
        {season.episodes.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">مفيش حلقات في الموسم ده — دوس «حلقة» لإضافة واحدة أو الصق لينكات كتير.</div>
        )}
      </div>
    </div>
  );
}
