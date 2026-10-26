// منطق نموذج العمل: إنشاء/تطبيع/فحص/بيانات تلقائية — نفس core.py
import type { EpisodeT, SeasonT, Work, MySettings, MetaField, ExportState } from "./types";
import { META_FIELDS, DEFAULT_SETTINGS, SERIES_CATS } from "./types";
import { episodeHasLink, episodeLinks, episodeServers, normalizeUrl, newEpisode } from "./urls";
import { workSignature } from "./signature";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function guessHub(category: string, lang = ""): string {
  if (category === "أنمي") return "anime";
  if (category === "كرتون") return "cartoon";
  return lang === "ar" ? "arabic" : "eng";
}

export function newWork(partial: Partial<Work> & { title: string }): Work {
  const w: Work = {
    id: partial.id || uid(),
    sid: partial.sid || "",
    title: partial.title || "بدون اسم",
    type: partial.type === "movie" ? "movie" : "series",
    category: partial.category || (partial.type === "movie" ? "فيلم" : "مسلسل"),
    hub: partial.hub || "",
    year: String(partial.year || ""),
    overview: partial.overview || "",
    poster: partial.poster || "",
    posterLocal: partial.posterLocal || "",
    backdrop: partial.backdrop || "",
    rating: String(partial.rating || ""),
    studio: partial.studio || "",
    genres: partial.genres || "",
    classification: partial.classification || "",
    altTitle: partial.altTitle || "",
    expSig: partial.expSig || "",
    added: partial.added || new Date().toISOString().slice(0, 19),
    metaLocked: partial.metaLocked || [],
    done: partial.done ?? false,
    seasons: partial.seasons && partial.seasons.length ? partial.seasons : [{ number: 1, episodes: [newEpisode(1)] }],
  };
  if (!w.hub) w.hub = guessHub(w.category);
  return w;
}

/** يكمّل الحقول الناقصة ويصلّح الأعمال القديمة أو اللي اتعدّلت بالإيد (مثل normalize_work) */
export function normalizeWork(w: Record<string, unknown>): Work {
  const nw: Work = {
    id: String(w.id || uid()),
    sid: String(w.sid || ""),
    title: String(w.title || "بدون اسم"),
    type: w.type === "movie" ? "movie" : "series",
    category: String(w.category || (w.type === "movie" ? "فيلم" : "مسلسل")),
    hub: String(w.hub || ""),
    year: String(w.year || ""),
    overview: String(w.overview || ""),
    poster: String(w.poster || ""),
    posterLocal: String(w.poster_local || w.posterLocal || ""),
    backdrop: String(w.backdrop || ""),
    rating: String(w.rating || ""),
    studio: String(w.studio || ""),
    genres: String(w.genres || ""),
    classification: String(w.classification || ""),
    altTitle: String(w.alt_title || w.altTitle || ""),
    expSig: String(w.exp_sig || w.expSig || ""),
    added: String(w.added || ""),
    metaLocked: Array.isArray(w.meta_locked) ? (w.meta_locked as string[]).map(String) : Array.isArray(w.metaLocked) ? (w.metaLocked as string[]).map(String) : [],
    done: Boolean(w.done),
    seasons: [],
  };
  const seasons = Array.isArray(w.seasons) ? (w.seasons as Record<string, unknown>[]) : [];
  const list: SeasonT[] = seasons.length ? seasons : [{ number: 1, episodes: [newEpisode(1)] }];
  list.forEach((s, i) => {
    const season: SeasonT = { number: Number(s.number ?? i + 1), sourceUrl: String(s.source_url || s.sourceUrl || ""), episodes: [] };
    const eps = Array.isArray(s.episodes) ? (s.episodes as Record<string, unknown>[]) : [];
    const epList = eps.length ? eps : [newEpisode(1) as unknown as Record<string, unknown>];
    epList.forEach((e, j) => {
      const ep: EpisodeT = {
        number: Number(e.number ?? j + 1),
        title: String(e.title || ""),
        link: String(e.link || ""),
        servers: Array.isArray(e.servers) ? (e.servers as EpisodeT["servers"]) : [],
      };
      season.episodes.push(ep);
    });
    nw.seasons.push(season);
  });
  if (!nw.hub) nw.hub = guessHub(nw.category);
  return nw;
}

export function workProgress(w: Work): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const s of w.seasons) {
    for (const e of s.episodes) {
      total += 1;
      if (episodeHasLink(e)) filled += 1;
    }
  }
  return { filled, total };
}

/** الصورة اللي بتظهر في الواجهة: المرفوع من الجهاز بيتعرض من مكتبة صور الموقع */
export function displayPoster(w: Pick<Work, "poster" | "posterLocal">): string {
  if (w.posterLocal) return `/api/images/file/${w.posterLocal.replace(/^images\//, "")}`;
  return w.poster || "";
}

export function exportPoster(w: Pick<Work, "poster" | "posterLocal">, prefix = ""): string {
  if (w.posterLocal) return prefix ? prefix.replace(/\/?$/, "/") + w.posterLocal.replace(/^images\//, "") : "";
  return w.poster || "";
}

function fmtNums(nums: number[], limit = 12): string {
  const s = nums.slice(0, limit).join(", ");
  return s + (nums.length > limit ? " ..." : "");
}

export interface Issue {
  level: "error" | "warn";
  msg: string;
}

/** فحص قبل الاستخراج: error = هيبوظ/هيتخطى، warn = تنبيه */
export function validateWork(w: Work, imagePrefix = ""): Issue[] {
  const issues: Issue[] = [];
  const movie = w.type === "movie";
  if (!w.title.trim()) issues.push({ level: "error", msg: "الاسم فاضي" });
  const { filled } = workProgress(w);
  if (filled === 0) {
    issues.push({ level: "error", msg: "مفيش ولا لينك متسجل (العمل ده هيتخطى في الـ SQL)" });
    return issues;
  }
  const seen = new Map<string, string[]>();
  for (const s of w.seasons) {
    const label = movie ? "" : `الموسم ${s.number} - `;
    const have = new Set(s.episodes.filter(episodeHasLink).map((e) => e.number));
    if (!movie && have.size) {
      const missing: number[] = [];
      for (let n = 1; n <= Math.max(...have); n++) if (!have.has(n)) missing.push(n);
      if (missing.length) issues.push({ level: "warn", msg: `${label}حلقات من غير لينك: ${fmtNums(missing)}` });
    }
    for (const e of s.episodes) {
      if (!episodeHasLink(e)) {
        if (episodeServers(e, true).some((x) => x.enabled === false)) {
          issues.push({ level: "warn", msg: `${label}${movie ? "" : `حلقة ${e.number}`}: كل سيرفرات الحلقة مقفولة (مش هتتصدّر)` });
        }
        continue;
      }
      const tag = label + (movie ? "" : `حلقة ${e.number}`);
      for (const u of episodeLinks(e)) {
        if (!/^https?:\/\//i.test(u) || u.includes(" ") || !u.includes(".")) {
          issues.push({ level: "error", msg: `${tag}: لينك مش سليم: ${u.slice(0, 70)}` });
        }
        const arr = seen.get(u) || [];
        arr.push(tag);
        seen.set(u, arr);
      }
    }
  }
  if (!movie) {
    for (const [u, tags] of seen) {
      if (tags.length > 1) issues.push({ level: "warn", msg: `نفس اللينك متكرر في أكتر من حلقة (${tags.slice(0, 4).join(", ")}): ${u.slice(0, 60)}` });
    }
  }
  if (!exportPoster(w, imagePrefix)) {
    if ((w.posterLocal || "").trim()) {
      issues.push({ level: "warn", msg: "الصورة اللي اخترتها من جهازك مش هتتصدّر في الـ SQL: حط مسار رفع الصور في الإعدادات (أو اختار صورة بلينك)" });
    } else {
      issues.push({ level: "warn", msg: "مفيش صورة للعمل (poster)" });
    }
  }
  if (!String(w.year || "").trim()) issues.push({ level: "warn", msg: "مفيش سنة إصدار (release_year هتبقى NULL)" });
  return issues;
}

export function validationReport(works: Work[], imagePrefix = ""): { text: string; errors: number; warns: number } {
  let errors = 0;
  let warns = 0;
  const blocks: string[] = [];
  for (const w of works) {
    const issues = validateWork(w, imagePrefix);
    if (!issues.length) continue;
    const lines = issues.map((i) => {
      if (i.level === "error") {
        errors += 1;
        return `   ❌ ${i.msg}`;
      }
      warns += 1;
      return `   ⚠ ${i.msg}`;
    });
    blocks.push(`• ${w.title}\n${lines.join("\n")}`);
  }
  return { text: blocks.join("\n\n"), errors, warns };
}

// ---------------------------------------------------------------------------
// البيانات التلقائية (Metadata)
// ---------------------------------------------------------------------------
export function metadataChanges(work: Work, fields: Record<string, string>): Array<{ key: MetaField; label: string; old: string; new: string; status: "fill" | "same" | "conflict" | "locked" }> {
  const locked = new Set(work.metaLocked || []);
  const rows: Array<{ key: MetaField; label: string; old: string; new: string; status: "fill" | "same" | "conflict" | "locked" }> = [];
  for (const k of META_FIELDS) {
    const nv = String(fields[k] || "").trim();
    if (!nv) continue;
    let old = String(work[k as keyof Work] || "").trim();
    if (k === "poster" && !old && work.posterLocal) old = "(صورة من جهازك)";
    let status: "fill" | "same" | "conflict" | "locked";
    if (old === nv) status = "same";
    else if (locked.has(k)) status = "locked";
    else if (old) status = "conflict";
    else status = "fill";
    rows.push({ key: k, label: META_LABELS[k], old, new: nv, status });
  }
  return rows;
}

/** بيملا الحقول الفاضية وغير المقفولة بس. force = موافقة صراحة. الاسم مبيتبدّلش إلا بـ force */
export function applyMetadata(work: Work, fields: Record<string, string>, force: string[] = []): string[] {
  const changed: string[] = [];
  const forceSet = new Set(force);
  for (const row of metadataChanges(work, fields)) {
    const k = row.key;
    if (row.status === "same") continue;
    if (!forceSet.has(k)) {
      if (row.status !== "fill" || k === "title") continue;
      if (k === "poster" && work.posterLocal) continue;
    }
    (work as unknown as Record<string, string>)[k] = row.new;
    changed.push(k);
    if (forceSet.has(k) && (work.metaLocked || []).includes(k)) {
      work.metaLocked = work.metaLocked.filter((x) => x !== k);
    }
  }
  return changed;
}

export function lockFields(work: Work, keys: string[]): void {
  if (!work.metaLocked) work.metaLocked = [];
  for (const k of keys) {
    if ((META_FIELDS as readonly string[]).includes(k) && !work.metaLocked.includes(k)) work.metaLocked.push(k);
  }
}

/** بيملا أسماء الحلقات الفاضية بس (من مواسم المصدر). مبيلمسش لينكات ولا أسماء موجودة */
export function applyEpisodeTitles(work: Work, seasons: SeasonT[]): number {
  let n = 0;
  const have = new Map<number, Map<number, EpisodeT>>();
  for (const s of work.seasons) {
    have.set(s.number, new Map(s.episodes.map((e) => [e.number, e])));
  }
  for (const s of seasons || []) {
    const mine = have.get(s.number);
    if (!mine) continue;
    for (const e of s.episodes) {
      const ep = mine.get(e.number);
      if (ep && !(ep.title || "").trim() && (e.title || "").trim()) {
        ep.title = e.title.trim();
        n += 1;
      }
    }
  }
  return n;
}

export function stateOf(w: Work): ExportState {
  if (!w.expSig) return "new";
  return w.expSig === workSignature(w) ? "done" : "changed";
}

export const STATE_LABEL: Record<ExportState, string> = { new: "جديد", changed: "معدّل", done: "متصدّر" };

export function defaultSettings(s?: Partial<MySettings> | null): MySettings {
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export function blankSeasons(nSeasons: number, nEps: number): SeasonT[] {
  return Array.from({ length: nSeasons }, (_, i) => ({
    number: i + 1,
    episodes: Array.from({ length: nEps }, (_, j) => newEpisode(j + 1)),
  }));
}

export function isSeriesCat(cat: string): boolean {
  return (SERIES_CATS as readonly string[]).includes(cat);
}

export { normalizeUrl };
