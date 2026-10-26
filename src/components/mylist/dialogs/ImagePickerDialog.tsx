"use client";
// نافذة اختيار الصورة: بحث خارجي / من جهازك / مكتبة الصور / رابط مباشر + معاينة
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/mylist/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Search, Upload, Library, Link2, Loader2, Trash2, Check } from "lucide-react";
import type { ImageResult, Work } from "@/lib/mylist/types";

interface LibraryImage {
  id: string;
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export function ImagePickerDialog() {
  const dialog = useStore((s) => s.dialogs.imagePicker);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const saveWork = useStore((s) => s.saveWork);
  const { toast } = useToast();
  const work = works.find((w) => w.id === dialog?.workId) || null;
  const isBackdrop = dialog?.field === "backdrop";

  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ImageResult[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ImageResult | null>(null);
  const [directUrl, setDirectUrl] = useState("");
  const [library, setLibrary] = useState<LibraryImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number | null>(null);

  const currentUrl = work ? (isBackdrop ? work.backdrop : work.poster ? work.poster : work.posterLocal ? `/api/images/file/${work.posterLocal.replace(/^images\//, "")}` : "") : "";

  const doSearch = useCallback(async (q: string): Promise<void> => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/image-search?q=${encodeURIComponent(q)}&kind=${isBackdrop ? "backdrop" : "poster"}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: ImageResult[]; failed?: string[] };
      setItems(data.items || []);
      setFailed(data.failed || []);
    } catch {
      setItems([]);
      setFailed(["تعذّر الوصول للنت"]);
    } finally {
      setSearching(false);
    }
  }, [isBackdrop]);

  // بحث أولي باسم العمل
  useEffect(() => {
    if (dialog?.open && work) {
      setTab("search");
      setSelected(null);
      setDirectUrl("");
      const q = work.altTitle || work.title;
      setQuery(q);
      void doSearch(q);
      void loadLibrary();
    }
     
  }, [dialog?.open]);

  // بحث مباشر مع تأخير
  useEffect(() => {
    if (!dialog?.open || tab !== "search") return;
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => void doSearch(query), 450);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query, dialog?.open, tab, doSearch]);

  const loadLibrary = async (): Promise<void> => {
    try {
      const res = await fetch("/api/images", { cache: "no-store" });
      const data = (await res.json()) as { images?: LibraryImage[] };
      setLibrary(data.images || []);
    } catch {
      /* تجاهل */
    }
  };

  if (!dialog) return null;
  const close = (): void => setDialog("imagePicker", null);

  const applyUrl = async (url: string, posterLocal = ""): Promise<void> => {
    if (!work) return;
    const next: Work = JSON.parse(JSON.stringify(work));
    if (isBackdrop) {
      next.backdrop = url;
    } else {
      next.poster = url;
      next.posterLocal = posterLocal;
    }
    // اختيار صورة بيقفل حقل الصورة من التحديث التلقائي
    if (!isBackdrop && !next.metaLocked.includes("poster")) next.metaLocked.push("poster");
    const ok = await saveWork(next);
    if (ok) toast({ title: "اتغيرت الصورة" });
    else toast({ title: "فشل الحفظ", variant: "destructive" });
    close();
  };

  const removeCurrent = async (): Promise<void> => {
    if (!work) return;
    const next: Work = JSON.parse(JSON.stringify(work));
    if (isBackdrop) next.backdrop = "";
    else {
      next.poster = "";
      next.posterLocal = "";
    }
    await saveWork(next);
    toast({ title: "اتشالت الصورة" });
    close();
  };

  const onUploadFile = async (file: File): Promise<void> => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "الملف مش صورة", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("فشل قراءة الملف"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, data: dataUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }
      if (data.url) {
        await loadLibrary();
        setTab("library");
        toast({ title: "اترفعت الصورة", description: "دوس «استخدام» عليها من المكتبة" });
      }
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const libraryPosters = works
    .filter((w) => w.id !== work?.id && (w.poster || w.posterLocal))
    .map((w) => ({ url: w.poster || `/api/images/file/${w.posterLocal!.replace(/^images\//, "")}`, title: w.title }));

  return (
    <Dialog open={dialog.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isBackdrop ? "صورة الخلفية" : "صورة العمل"} — {work?.title}</DialogTitle>
          <DialogDescription>بحث من مصادر رسمية، رفع من جهازك، مكتبة الصور، أو لينك مباشر — مع معاينة قبل الحفظ.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid grid-cols-4 w-full rounded-xl">
            <TabsTrigger value="search" className="text-xs sm:text-sm">
              <Search className="w-4 h-4 sm:me-1" /> بحث خارجي
            </TabsTrigger>
            <TabsTrigger value="device" className="text-xs sm:text-sm">
              <Upload className="w-4 h-4 sm:me-1" /> من جهازك
            </TabsTrigger>
            <TabsTrigger value="library" className="text-xs sm:text-sm">
              <Library className="w-4 h-4 sm:me-1" /> المكتبة
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs sm:text-sm">
              <Link2 className="w-4 h-4 sm:me-1" /> لينك مباشر
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto mt-3 pe-1">
            <TabsContent value="search" className="mt-0 space-y-3">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن صور…" dir="auto" />
              {searching && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> بيبحث في المصادر…
                </div>
              )}
              {!searching && failed.length > 0 && items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">تعذّر الوصول لـ: {failed.join(" · ")}</p>
              )}
              <ImageGrid items={items} selected={selected} onSelect={setSelected} />
            </TabsContent>

            <TabsContent value="device" className="mt-0 space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 transition-colors flex flex-col items-center justify-center gap-2 text-primary"
              >
                {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                <span className="text-sm font-bold">{uploading ? "بيرفع…" : "دوس واختار صورة من جهازك (أو الصق من الحافظة)"}</span>
                <span className="text-[11px] text-muted-foreground">JPG / PNG / WEBP — لحد 8MB</span>
              </button>
            </TabsContent>

            <TabsContent value="library" className="mt-0 space-y-4">
              {library.length === 0 && libraryPosters.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">المكتبة فاضية — ارفع صور من تبويب «من جهازك».</p>
              )}
              {library.length > 0 && (
                <>
                  <h4 className="text-sm font-bold text-muted-foreground">الصور اللي رفعتها</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {library.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => setSelected({ url: img.url, thumb: img.url, title: img.filename, source: "مكتبة", w: 0, h: 0 })}
                        className={cn("rounded-xl overflow-hidden border-2 transition-all", selected?.url === img.url ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-secondary")}
                      >
                        { }
                        <img src={img.url} alt={img.filename} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {libraryPosters.length > 0 && (
                <>
                  <h4 className="text-sm font-bold text-muted-foreground">بوسترات أعمالك التانية</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {libraryPosters.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setSelected({ url: p.url, thumb: p.url, title: p.title, source: "قائمتك", w: 0, h: 0 })}
                        className={cn("rounded-xl overflow-hidden border-2 transition-all", selected?.url === p.url ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-secondary")}
                      >
                        { }
                        <img src={p.url} alt={p.title} className="w-full aspect-[2/3] object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="url" className="mt-0 space-y-3">
              <Input value={directUrl} onChange={(e) => setDirectUrl(e.target.value)} placeholder="https://example.com/poster.jpg" dir="ltr" />
              {directUrl && (
                <div className="rounded-xl overflow-hidden border border-border bg-muted/40 p-3 flex justify-center">
                  { }
                  <img src={directUrl} alt="معاينة" className="max-h-64 object-contain rounded-lg" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")} />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* شريط المعاينة والاستخدام */}
        <div className="border-t border-border pt-3 mt-2 flex items-center gap-3">
          <div className="w-16 h-24 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {selected ? (
               
              <img src={selected.thumb} alt={selected.title} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : currentUrl ? (
               
              <img src={currentUrl} alt="الحالية" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-[10px] text-muted-foreground">مفيش</span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-xs text-muted-foreground">
            {selected ? (
              <>
                <p className="font-bold text-foreground truncate">{selected.title || "صورة مختارة"}</p>
                <p>
                  {selected.source}
                  {selected.w ? ` · ${selected.w}×${selected.h}` : ""}
                </p>
              </>
            ) : (
              <p>اختار صورة من فوق (أو الحالية هي اللي معروضة)</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void removeCurrent()}>
              <Trash2 className="w-4 h-4 me-1" /> إزالة الحالية
            </Button>
            <Button
              size="sm"
              className="rounded-full px-5"
              onClick={() => {
                if (selected) void applyUrl(selected.url);
                else if (tab === "url" && directUrl.trim()) void applyUrl(directUrl.trim());
                else if (currentUrl) close();
              }}
            >
              <Check className="w-4 h-4 me-1" /> استخدام
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageGrid({ items, selected, onSelect }: { items: ImageResult[]; selected: ImageResult | null; onSelect: (i: ImageResult) => void }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {items.map((it, i) => (
        <button
          key={`${it.url}-${i}`}
          onClick={() => onSelect(it)}
          className={cn("relative rounded-xl overflow-hidden border-2 transition-all", selected?.url === it.url ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-secondary")}
          title={it.title}
        >
          { }
          <img src={it.thumb} alt={it.title} className="w-full aspect-[2/3] object-cover bg-muted" loading="lazy" referrerPolicy="no-referrer" />
          <span className="absolute bottom-1 right-1 rounded bg-black/60 text-white text-[9px] px-1.5">{it.source}</span>
          {selected?.url === it.url && (
            <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
              <Check className="w-3 h-3" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
