"use client";
// تبويب "نتائج البحث": نتايج النت مع الشرائح وزرار الإضافة للقائمة
import { useState } from "react";
import { useStore, filterMyList } from "@/lib/mylist/store";
import { PosterImg, CatBadge, EmptyState } from "./common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus, Globe, SearchX, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { newWork } from "@/lib/mylist/logic";
import { newEpisode } from "@/lib/mylist/urls";
import type { SearchResult, Work } from "@/lib/mylist/types";

const SOURCE_LABEL: Record<string, string> = { tmdb: "TMDB", tvmaze: "TVmaze", itunes: "iTunes", wiki: "ويكيبيديا" };

export function ResultsView() {
  const query = useStore((s) => s.query);
  const results = useStore((s) => s.onlineResults);
  const loading = useStore((s) => s.onlineLoading);
  const error = useStore((s) => s.onlineError);
  const catFilter = useStore((s) => s.catFilter);
  const works = useStore((s) => s.works);

  const filtered = filterResultsByCat(results, catFilter);

  if (query.trim().length < 2) {
    return (
      <EmptyState icon={<Globe className="w-8 h-8" />} title="اكتب اسم العمل في خانة البحث" sub="البحث بيشتغل تلقائي وأنت بتكتب: TMDB (بمفتاحك) + TVmaze + iTunes + ويكيبيديا العربية، وكلهم مع بعض. Enter = ابحث حالاً." />
    );
  }
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/60">
            <Skeleton className="aspect-[2/3] w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error && !results.length) {
    return (
      <EmptyState icon={<WifiOff className="w-8 h-8" />} title="حصلت مشكلة في البحث" sub={error}>
        <Button variant="outline" className="rounded-full" onClick={() => useStore.getState().runOnlineSearch(query)}>
          جرّب تاني
        </Button>
      </EmptyState>
    );
  }
  if (!filtered.length) {
    return (
      <EmptyState
        icon={<SearchX className="w-8 h-8" />}
        title={`ملقيتش نتايج لـ «${query}»${catFilter !== "الكل" ? ` في ${catFilter}` : ""}`}
        sub="جرّب كلمات أقل أو بالإنجليزي، أو شيل فلتر التصنيف. تقدر كمان تضيف العمل يدوي."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
      {filtered.map((r) => (
        <ResultCard key={`${r.source}-${r.ext_id}-${r.title}`} result={r} inList={isInList(works, r)} />
      ))}
    </div>
  );
}

function filterResultsByCat(res: SearchResult[], flt: string): SearchResult[] {
  if (flt === "الكل") return res;
  if (flt === "أفلام") return res.filter((r) => r.type === "movie");
  if (flt === "مسلسلات") return res.filter((r) => r.type === "series" && r.category === "مسلسل");
  return res.filter((r) => r.category === flt);
}

function isInList(works: Work[], r: SearchResult): boolean {
  return works.some((w) => w.title === r.title && w.year === r.year);
}

function ResultCard({ result, inList }: { result: SearchResult; inList: boolean }) {
  const saveWork = useStore((s) => s.saveWork);
  const setDialog = useStore((s) => s.setDialog);
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const add = async (): Promise<void> => {
    setAdding(true);
    try {
      const w = newWork({
        title: result.title,
        type: result.type,
        category: result.category,
        year: result.year,
        overview: result.overview,
        poster: result.poster,
        backdrop: result.backdrop || "",
        altTitle: result.alt_title || "",
        rating: result.rating || "",
        studio: result.studio || "",
        genres: result.genres || "",
        classification: result.classification || "",
        hub: result.category === "أنمي" ? "anime" : result.category === "كرتون" ? "cartoon" : result.lang === "ar" ? "arabic" : "eng",
      });
      // المواسم من المصدر (TMDB/TVmaze) — ولو فشل موسم فاضي زي البرنامج
      let seasons: Work["seasons"] | null = null;
      try {
        const res = await fetch("/api/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result }),
        });
        const data = (await res.json()) as { seasons?: Work["seasons"] };
        if (data.seasons?.length) seasons = data.seasons;
      } catch {
        /* موسم فاضي */
      }
      if (seasons) w.seasons = seasons;
      else w.seasons = [{ number: 1, episodes: [newEpisode(1)] }];
      const ok = await saveWork(w);
      if (ok) toast({ title: `اتضاف «${w.title}» لقائمتك`, description: "افتحه من قائمتي وزّق لينكات الحلقات" });
      else toast({ title: "فشل الحفظ", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border/70 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all ml-fade-up">
      <div className="relative aspect-[2/3]">
        <PosterImg src={result.poster} title={result.title} className="absolute inset-0" />
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <CatBadge category={result.category} />
          <span className="rounded-full bg-black/60 text-white text-[10px] px-2 py-0.5 font-bold">
            {SOURCE_LABEL[result.source] || result.source}
          </span>
        </div>
      </div>
      <div className="p-2.5 space-y-1.5">
        <h3 className="text-sm font-bold leading-snug line-clamp-1" title={result.title}>
          {result.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {result.year && <span>{result.year}</span>}
          {result.rating && <span className="text-amber-600 font-bold">★ {result.rating}</span>}
        </div>
        <Button size="sm" disabled={inList || adding} onClick={() => void add()} className={cn("w-full rounded-full h-8 text-xs", inList && "opacity-60")}>
          <Plus className="w-3.5 h-3.5 me-1" />
          {inList ? "في قائمتك" : adding ? "بيضيف…" : "إضافة للقائمة"}
        </Button>
      </div>
    </div>
  );
}

