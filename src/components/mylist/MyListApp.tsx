"use client";
// التطبيق الرئيسي: الشريط العلوي + التبويبات + كل النوافذ
import { useEffect } from "react";
import { useStore } from "@/lib/mylist/store";
import { TopBar } from "./TopBar";
import { MyListView } from "./MyListView";
import { ResultsView } from "./ResultsView";
import { WorkView } from "./WorkView";
import { ManualAddDialog } from "./dialogs/ManualAddDialog";
import { DetailsDialog } from "./dialogs/DetailsDialog";
import { ImagePickerDialog } from "./dialogs/ImagePickerDialog";
import { ServersDialog } from "./dialogs/ServersDialog";
import { PasteDialog } from "./dialogs/PasteDialog";
import { ScrapeDialog } from "./dialogs/ScrapeDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import { ExportDialog } from "./dialogs/ExportDialog";
import { MetadataDialog } from "./dialogs/MetadataDialog";
import { PreviewDialog } from "./dialogs/PreviewDialog";
import { CheckLinksDialog } from "./dialogs/CheckLinksDialog";
import { ReportDialog, BackupDialog, HelpDialog } from "./dialogs/ReportDialog";
import { Library, Search, Clapperboard } from "lucide-react";

export function MyListApp() {
  const loadWorks = useStore((s) => s.loadWorks);
  const loadSettings = useStore((s) => s.loadSettings);
  const loaded = useStore((s) => s.loaded);
  const openWorkId = useStore((s) => s.openWorkId);

  useEffect(() => {
    void loadSettings();
    void loadWorks();
     
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-teal-50/80 via-background to-cyan-50/60">
      <TopBar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pb-16">
        {openWorkId && loaded ? (
          <WorkView workId={openWorkId} />
        ) : (
          <TabsArea />
        )}
      </main>
      <footer className="mt-auto border-t border-border/60 bg-card/60 backdrop-blur py-3 text-center text-xs text-muted-foreground">
        قائمتي — ويب · مدير الأعمال والحلقات والسيرفرات · تصدير SQL لقاعدة vibehub
      </footer>

      {/* النوافذ */}
      <ManualAddDialog />
      <DetailsDialog />
      <ImagePickerDialog />
      <ServersDialog />
      <PasteDialog />
      <ScrapeDialog />
      <SettingsDialog />
      <ExportDialog />
      <MetadataDialog />
      <PreviewDialog />
      <CheckLinksDialog />
      <ReportDialog />
      <BackupDialog />
      <HelpDialog />
    </div>
  );
}

function TabsArea() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const loaded = useStore((s) => s.loaded);
  const loadingWorks = useStore((s) => s.loadingWorks);

  return (
    <div className="pt-4">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView("mylist")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${view === "mylist" ? "bg-primary text-primary-foreground shadow-md" : "bg-card text-muted-foreground hover:bg-secondary"}`}
          aria-pressed={view === "mylist"}
        >
          <Library className="w-4 h-4" />
          قائمتي
        </button>
        <button
          onClick={() => setView("results")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${view === "results" ? "bg-primary text-primary-foreground shadow-md" : "bg-card text-muted-foreground hover:bg-secondary"}`}
          aria-pressed={view === "results"}
        >
          <Search className="w-4 h-4" />
          نتائج البحث
        </button>
      </div>
      {!loaded && loadingWorks ? (
        <LoadingGrid />
      ) : view === "mylist" ? (
        <MyListView />
      ) : (
        <ResultsView />
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/60">
          <div className="ml-skeleton aspect-[2/3] w-full" />
          <div className="p-3 space-y-2">
            <div className="ml-skeleton h-4 rounded w-3/4" />
            <div className="ml-skeleton h-3 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyIntro() {
  return null;
}

export { Clapperboard, EmptyIntro };
