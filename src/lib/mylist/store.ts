"use client";
// مخزن حالة التطبيق: الأعمال + البحث + النوافذ — Zustand
import { create } from "zustand";
import type { MySettings, SearchResult, Work } from "@/lib/mylist/types";
import { normText, textMatches } from "@/lib/mylist/text";

export interface PreviewServer {
  name: string;
  url: string;
  enabled: boolean;
}

export interface DialogState {
  imagePicker: { open: boolean; workId: string; field: "poster" | "backdrop" } | null;
  servers: { open: boolean; workId: string; seasonNo: number; epNo: number } | null;
  paste: { open: boolean; workId: string; seasonNo: number; epNo: number | null } | null;
  scrape: { open: boolean; workId: string; seasonNo: number } | null;
  settingsOpen: boolean;
  exportOpen: boolean;
  metadata: { open: boolean; workId: string; result: { found: boolean; source: string; matched: string; fields: Record<string, string>; seasons?: unknown } } | null;
  preview: { open: boolean; title: string; servers: PreviewServer[] } | null;
  checkLinks: { open: boolean; workId: string } | null;
  manualAdd: { open: boolean; title: string } | null;
  details: { open: boolean; workId: string } | null;
  report: { open: boolean; title: string; text: string; errors: number; warns: number } | null;
  backupOpen: boolean;
  helpOpen: boolean;
}

interface StoreState {
  works: Work[];
  settings: MySettings;
  loaded: boolean;
  loadingWorks: boolean;
  view: "mylist" | "results";
  openWorkId: string | null;
  query: string;
  onlineResults: SearchResult[];
  onlineLoading: boolean;
  onlineError: string;
  catFilter: string;
  saving: boolean;
  dialogs: DialogState;

  loadWorks: (silent?: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSettings: (s: Partial<MySettings>) => Promise<void>;
  saveWork: (w: Work) => Promise<boolean>;
  deleteWork: (id: string) => Promise<boolean>;
  setView: (v: "mylist" | "results") => void;
  openWork: (id: string | null) => void;
  setQuery: (q: string) => void;
  runOnlineSearch: (q: string, jump?: boolean) => Promise<void>;
  setCatFilter: (c: string) => void;
  setDialog: <K extends keyof DialogState>(key: K, value: DialogState[K]) => void;
  closeAllDialogs: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  works: [],
  settings: {
    tmdb_key: "",
    dialect: "mssql",
    db_name: "",
    schema: "dbo",
    image_url_prefix: "",
    auto_metadata: true,
  },
  loaded: false,
  loadingWorks: false,
  view: "mylist",
  openWorkId: null,
  query: "",
  onlineResults: [],
  onlineLoading: false,
  onlineError: "",
  catFilter: "الكل",
  saving: false,
  dialogs: {
    imagePicker: null,
    servers: null,
    paste: null,
    scrape: null,
    settingsOpen: false,
    exportOpen: false,
    metadata: null,
    preview: null,
    checkLinks: null,
    manualAdd: null,
    details: null,
    report: null,
    backupOpen: false,
    helpOpen: false,
  },

  loadWorks: async (silent = false) => {
    if (!silent) set({ loadingWorks: true });
    try {
      const res = await fetch("/api/works", { cache: "no-store" });
      const data = (await res.json()) as { works?: Work[]; error?: string };
      if (data.works) set({ works: data.works, loaded: true });
    } catch {
      /* الشبكة — بنجرب تاني لما المستخدم يعمل أي حاجة */
    } finally {
      set({ loadingWorks: false });
    }
  },

  loadSettings: async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = (await res.json()) as { settings?: MySettings };
      if (data.settings) set({ settings: data.settings });
    } catch {
      /* تجاهل */
    }
  },

  saveSettings: async (s) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const data = (await res.json()) as { settings?: MySettings };
      if (data.settings) set({ settings: data.settings });
    } catch {
      /* تجاهل */
    }
  },

  saveWork: async (w) => {
    set({ saving: true });
    try {
      const res = await fetch(`/api/works/${w.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(w),
      });
      const data = (await res.json()) as { work?: Work; error?: string };
      if (data.work) {
        const works = get().works;
        const idx = works.findIndex((x) => x.id === w.id);
        const next = idx >= 0 ? works.map((x) => (x.id === w.id ? data.work! : x)) : [...works, data.work!];
        set({ works: next });
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      set({ saving: false });
    }
  },

  deleteWork: async (id) => {
    try {
      await fetch(`/api/works/${id}`, { method: "DELETE" });
      set({ works: get().works.filter((w) => w.id !== id), openWorkId: get().openWorkId === id ? null : get().openWorkId });
      return true;
    } catch {
      return false;
    }
  },

  setView: (v) => set({ view: v }),

  openWork: (id) => set({ openWorkId: id, view: id ? "mylist" : get().view }),

  setQuery: (q) => {
    set({ query: q });
    // البحث أونلاين بعد توقف الكتابة لحظة (380ms) ومن حرفين
    window.clearTimeout((window as unknown as { __mlSearchTimer?: number }).__mlSearchTimer);
    if (q.trim().length < 2) {
      set({ onlineResults: [], onlineLoading: false, onlineError: "" });
      return;
    }
    set({ onlineLoading: true });
    (window as unknown as { __mlSearchTimer?: number }).__mlSearchTimer = window.setTimeout(() => {
      void get().runOnlineSearch(q);
    }, 380);
  },

  runOnlineSearch: async (q) => {
    const rid = q;
    set({ onlineLoading: true, onlineError: "" });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&flt=${encodeURIComponent(get().catFilter)}`, { cache: "no-store" });
      const data = (await res.json()) as { results?: SearchResult[]; error?: string };
      if (get().query !== rid) return; // استجابة قديمة
      set({ onlineResults: data.results || [], onlineError: data.error || "" });
    } catch {
      if (get().query === rid) set({ onlineError: "تعذّر الوصول للنت" });
    } finally {
      if (get().query === rid) set({ onlineLoading: false });
    }
  },

  setCatFilter: (c) => {
    set({ catFilter: c });
    const q = get().query;
    if (q.trim().length >= 2) void get().runOnlineSearch(q);
  },

  setDialog: (key, value) => set({ dialogs: { ...get().dialogs, [key]: value } }),

  closeAllDialogs: () =>
    set({
      dialogs: {
        imagePicker: null,
        servers: null,
        paste: null,
        scrape: null,
        settingsOpen: false,
        exportOpen: false,
        metadata: null,
        preview: null,
        checkLinks: null,
        manualAdd: null,
        details: null,
        report: null,
        backupOpen: false,
        helpOpen: false,
      },
    }),
}));

/** فلترة قائمتي بالبحث العربي الموحّد (كل الكلمات بأي ترتيب) */
export function filterMyList(works: Work[], query: string, cat: string): Work[] {
  const q = normText(query);
  return works.filter((w) => {
    if (cat === "أفلام" && w.type !== "movie") return false;
    if (cat === "مسلسلات" && !(w.type === "series" && w.category === "مسلسل")) return false;
    if ((cat === "أنمي" || cat === "كرتون") && w.category !== cat) return false;
    if (!q) return true;
    const hay = normText(`${w.title} ${w.altTitle} ${w.year}`);
    return textMatches(q, hay);
  });
}
