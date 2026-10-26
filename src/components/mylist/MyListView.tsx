"use client";
// تبويب "قائمتي": شرائح التصنيف + شبكة بطاقات الأعمال
import { useStore, filterMyList } from "@/lib/mylist/store";
import { PosterImg, CatBadge, StateBadge, EmptyState } from "./common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stateOf, workProgress } from "@/lib/mylist/logic";
import { Plus, Library, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { setEpisodeServers, episodeRawServers } from "@/lib/mylist/urls";
import type { Work } from "@/lib/mylist/types";

const CHIPS = ["الكل", "مسلسلات", "أفلام", "أنمي", "كرتون"];

export function MyListView() {
  const works = useStore((s) => s.works);
  const query = useStore((s) => s.query);
  const catFilter = useStore((s) => s.catFilter);
  const setCatFilter = useStore((s) => s.setCatFilter);
  const setDialog = useStore((s) => s.setDialog);

  const filtered = filterMyList(works, query, catFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold transition-all border",
              catFilter === c ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card text-muted-foreground border-border hover:bg-secondary"
            )}
            aria-pressed={catFilter === c}
          >
            {c}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} عمل</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Library className="w-8 h-8" />}
          title={query ? "مفيش نتايج مطابقة في قائمتك" : "قائمتك فاضية لسه"}
          sub={query ? "جرّب كلمة تانية أو صفّر البحث" : "ابحث عن عمل من الخانة اللي فوق واضغط «إضافة للقائمة»، أو ضيفه بإيدك"}
        >
          <Button onClick={() => setDialog("manualAdd", { open: true, title: "" })} className="rounded-full mt-2">
            <Plus className="w-4 h-4 me-1" /> إضافة يدوي
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {filtered.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkCard({ work }: { work: Work }) {
  const openWork = useStore((s) => s.openWork);
  const saveWork = useStore((s) => s.saveWork);
  const deleteWork = useStore((s) => s.deleteWork);
  const { toast } = useToast();
  const state = stateOf(work);
  const { filled, total } = workProgress(work);
  const pct = total ? Math.round((filled / total) * 100) : 0;

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-card border border-border/70 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer ml-fade-up"
      onClick={() => openWork(work.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openWork(work.id);
      }}
      aria-label={`فتح ${work.title}`}
    >
      <div className="relative aspect-[2/3]">
        <PosterImg src={work.poster ? work.poster : work.posterLocal ? `/api/images/file/${work.posterLocal.replace(/^images\//, "")}` : undefined} title={work.title} className="absolute inset-0" />
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <CatBadge category={work.category} />
          <StateBadge state={state} />
        </div>
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                className="w-8 h-8 rounded-full shadow-lg"
                onClick={(e) => e.stopPropagation()}
                title="حذف العمل من قائمتك (مش بيمسحه من القاعدة)"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>تحب تحذف «{work.title}»؟</AlertDialogTitle>
                <AlertDialogDescription>
                  الحذف من الموقع بيشيل العمل من قائمتك بس، ومبيمسحوش من قاعدة البيانات اللي صدّرت لها قبل كده.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>سيبه</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    const ok = await deleteWork(work.id);
                    toast({ title: ok ? "اتحذف العمل" : "فشل الحذف", variant: ok ? undefined : "destructive" });
                  }}
                >
                  احذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {work.year && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5">
            <span className="text-white text-xs font-bold">{work.year}</span>
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1.5">
        <h3 className="text-sm font-bold leading-snug line-clamp-1" title={work.title}>
          {work.title}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {filled}/{total} حلقة بلينك
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-teal-500" : "bg-cyan-500")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function updateEpisodeServers(work: Work, seasonNo: number, epNo: number, servers: ReturnType<typeof episodeRawServers>): Work {
  const next: Work = JSON.parse(JSON.stringify(work));
  const season = next.seasons.find((s) => s.number === seasonNo);
  const ep = season?.episodes.find((e) => e.number === epNo);
  if (ep) setEpisodeServers(ep, servers);
  return next;
}
