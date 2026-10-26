"use client";
// الشريط العلوي: الشعار + البحث المباشر + إضافة يدوي + قائمة أدوات
import { useRef, useState, useEffect } from "react";
import { useStore, filterMyList } from "@/lib/mylist/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Plus, Wrench, ListChecks, Link2Off, DatabaseBackup, Download, Upload, Settings2, CircleHelp, FileDown, Loader2, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { validationReport, workProgress } from "@/lib/mylist/logic";
import { useToast } from "@/hooks/use-toast";
import type { Work } from "@/lib/mylist/types";

export function TopBar() {
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const setView = useStore((s) => s.setView);
  const setDialog = useStore((s) => s.setDialog);
  const works = useStore((s) => s.works);
  const openWorkId = useStore((s) => s.openWorkId);
  const onlineLoading = useStore((s) => s.onlineLoading);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // اختصار Ctrl+F للبحث
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !openWorkId) {
        e.preventDefault();
        setDialog("manualAdd", { open: true, title: "" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDialog, openWorkId]);

  const onSearchChange = (v: string): void => {
    setQuery(v);
    if (v.trim().length >= 2) setView("results");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
        <button
          className="flex items-center gap-2 shrink-0"
          onClick={() => {
            useStore.getState().openWork(null);
            setQuery("");
            setView("mylist");
          }}
          aria-label="قائمتي — الصفحة الرئيسية"
        >
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
            <ListChecks className="w-5 h-5" />
          </span>
          <span className="hidden sm:block text-lg font-extrabold bg-gradient-to-l from-teal-600 to-cyan-600 bg-clip-text text-transparent">قائمتي</span>
        </button>

        <div className="relative flex-1 min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setView("results");
              if (e.key === "Escape") onSearchChange("");
            }}
            placeholder="ابحث في قائمتك أو في النت… (Ctrl+F)"
            className="pr-9 pl-9 rounded-full bg-background/90 border-border h-10 shadow-inner"
            aria-label="بحث"
          />
          {onlineLoading && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
          {!onlineLoading && query && (
            <button onClick={() => onSearchChange("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-secondary" aria-label="مسح البحث">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <Button onClick={() => setDialog("manualAdd", { open: true, title: "" })} className="rounded-full h-10 px-3 sm:px-4 shrink-0 shadow-md" title="إضافة يدوي (Ctrl+N)">
          <Plus className="w-4 h-4 sm:me-1" />
          <span className="hidden sm:inline">إضافة يدوي</span>
        </Button>

        <ToolsMenu
          onAction={(action) => {
            void handleTool(action, works, toast, setDialog);
          }}
        />
      </div>
    </header>
  );
}

type ToolAction = "validate" | "checkLinks" | "backupDownload" | "restore" | "export" | "settings" | "help";

function ToolsMenu({ onAction }: { onAction: (a: ToolAction) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-full h-10 px-3 shrink-0" title="أدوات">
          <Wrench className="w-4 h-4" />
          <span className="hidden md:inline ms-1">أدوات</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>أدوات</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction("validate")}>
          <ClipboardList className="w-4 h-4 me-2" /> فحص العمل (كل الأعمال)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("export")}>
          <FileDown className="w-4 h-4 me-2" /> استخراج SQL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction("backupDownload")}>
          <DatabaseBackup className="w-4 h-4 me-2" /> نسخة احتياطية JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("restore")}>
          <Upload className="w-4 h-4 me-2" /> استرجاع / دمج نسخة
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction("settings")}>
          <Settings2 className="w-4 h-4 me-2" /> الإعدادات
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("help")}>
          <CircleHelp className="w-4 h-4 me-2" /> الشرح
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

async function handleTool(
  action: ToolAction,
  works: Work[],
  toast: ReturnType<typeof useToast>["toast"],
  setDialog: (k: "checkLinks" | "settingsOpen" | "exportOpen" | "backupOpen" | "helpOpen" | "report", v: unknown) => void
): Promise<void> {
  switch (action) {
    case "validate": {
      if (!works.length) {
        toast({ title: "القائمة فاضية", description: "ضيف أعمال الأول وبعدين افحص" });
        return;
      }
      const settings = useStore.getState().settings;
      const rep = validationReport(works, settings.image_url_prefix);
      setDialog("report", {
        open: true,
        title: "فحص العمل",
        text: rep.text || "كل الأعمال سليمة، مفيش أخطاء ولا تنبيهات ✔",
        errors: rep.errors,
        warns: rep.warns,
      });
      break;
    }
    case "checkLinks": {
      setDialog("checkLinks", { open: true, workId: "" });
      break;
    }
    case "backupDownload": {
      try {
        const res = await fetch("/api/backup");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `my_list_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "اتنزلت النسخة الاحتياطية" });
      } catch {
        toast({ title: "فشل تنزيل النسخة", variant: "destructive" });
      }
      break;
    }
    case "restore":
      setDialog("backupOpen", true);
      break;
    case "export":
      setDialog("exportOpen", true);
      break;
    case "settings":
      setDialog("settingsOpen", true);
      break;
    case "help":
      setDialog("helpOpen", true);
      break;
  }
}

export function countLinks(w: Work): string {
  const { filled, total } = workProgress(w);
  return `${filled}/${total}`;
}

export { filterMyList, Link2Off, Download };
