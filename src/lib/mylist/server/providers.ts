// مزوّدات البحث أونلاين + البيانات التلقائية + البحث عن صور + فحص اللينكات
// نسخة سيرفر من أجزاء core.py (نفس نفس الـ endpoints والتحليل)
import type { ImageResult, MySettings, SearchResult, SeasonT } from "../types";
import { normText, hasArabic } from "../text";
import { newEpisode } from "../urls";

// UA متوافق مع سياسة Wikimedia (بيطلب شكل UA فيه تواصل) — وبيشتغل مع كل المصادر
const UA = "MyListWeb/1.0 (media list manager; +https://github.com/mylist-web) MyListWeb/1.0";

export async function httpJson<T = Record<string, unknown>>(url: string, timeout = 15000): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, "").trim();
}

// --- كاش بسيط بالذاكرة (TTL) ---
const cacheStore = new Map<string, { at: number; value: unknown }>();
function cacheGet(key: string, ttl: number): unknown {
  const hit = cacheStore.get(key);
  if (hit && Date.now() - hit.at < ttl * 1000) return hit.value;
  if (hit) cacheStore.delete(key);
  return undefined;
}
function cachePut(key: string, value: unknown): void {
  if (cacheStore.size > 200) cacheStore.clear();
  cacheStore.set(key, { at: Date.now(), value });
}

export function resolveTmdbKey(settings?: Partial<MySettings> | null): string {
  return String(settings?.tmdb_key || "").trim() || (process.env.TMDB_API_KEY || "").trim();
}

export function redact(text: string, key: string): string {
  const t = String(text);
  return key ? t.replace(key, "***") : t;
}

// --- TMDB ---
const TMDB = "https://api.themoviedb.org/3";
const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action", 10762: "Kids", 10765: "Sci-Fi", 10768: "War",
};

function tmdbCategory(media: string, genreIds: number[] | undefined, lang: string): string {
  if ((genreIds || []).includes(16)) return lang === "ja" ? "أنمي" : "كرتون";
  return media === "movie" ? "فيلم" : "مسلسل";
}

interface TmdbRaw {
  media_type?: string; id: number; title?: string; name?: string;
  release_date?: string; first_air_date?: string; overview?: string;
  poster_path?: string; backdrop_path?: string; genre_ids?: number[];
  original_language?: string; original_title?: string; original_name?: string;
  vote_average?: number;
}

export async function tmdbSearch(q: string, key: string): Promise<SearchResult[]> {
  const url = `${TMDB}/search/multi?api_key=${key}&language=ar-EG&include_adult=false&query=${encodeURIComponent(q)}`;
  const data = await httpJson<{ results?: TmdbRaw[] }>(url);
  const out: SearchResult[] = [];
  for (const r of data.results || []) {
    const media = r.media_type;
    if (media !== "movie" && media !== "tv") continue;
    const date = r.release_date || r.first_air_date || "";
    out.push({
      source: "tmdb",
      ext_id: r.id,
      type: media === "movie" ? "movie" : "series",
      title: r.title || r.name || "؟",
      year: date.slice(0, 4),
      overview: r.overview || "",
      poster: r.poster_path ? "https://image.tmdb.org/t/p/w342" + r.poster_path : "",
      category: tmdbCategory(media, r.genre_ids, r.original_language || ""),
      alt_title: r.original_title || r.original_name || "",
      lang: r.original_language || "",
      rating: r.vote_average ? r.vote_average.toFixed(1) : "",
      backdrop: r.backdrop_path ? "https://image.tmdb.org/t/p/w780" + r.backdrop_path : "",
      genres: [...new Set((r.genre_ids || []).filter((g) => g in TMDB_GENRES).map((g) => TMDB_GENRES[g]))].join(","),
    });
  }
  return out;
}

export async function tmdbDetails(r: SearchResult, key: string): Promise<SeasonT[]> {
  if (r.type === "movie") return [{ number: 1, episodes: [newEpisode(1)] }];
  const d = await httpJson<{ seasons?: Array<{ season_number: number; episode_count?: number }> }>(
    `${TMDB}/tv/${r.ext_id}?api_key=${key}&language=ar-EG`
  );
  const seasons: SeasonT[] = [];
  for (const s of d.seasons || []) {
    const n = s.season_number ?? 0;
    if (n === 0) continue;
    let eps: SeasonT["episodes"] = [];
    try {
      const sd = await httpJson<{ episodes?: Array<{ episode_number: number; name?: string }> }>(
        `${TMDB}/tv/${r.ext_id}/season/${n}?api_key=${key}&language=ar-EG`
      );
      for (const e of sd.episodes || []) {
        let name = e.name || "";
        if (/^(episode|الحلقة|حلقة)\s*\d+$/i.test(name.trim())) name = "";
        eps.push(newEpisode(e.episode_number, name));
      }
    } catch {
      /* موسم فاشل مش بيوقف الباقي */
    }
    if (!eps.length) eps = Array.from({ length: s.episode_count || 1 }, (_, i) => newEpisode(i + 1));
    seasons.push({ number: n, episodes: eps });
  }
  return seasons.length ? seasons : [{ number: 1, episodes: [newEpisode(1)] }];
}

// --- TVmaze ---
interface TvmazeShow {
  id: number; name: string; premiered?: string; summary?: string;
  image?: { medium?: string; original?: string };
  genres?: string[]; type?: string;
  rating?: { average?: number };
  network?: { name?: string }; webChannel?: { name?: string };
}

export async function tvmazeSearch(q: string): Promise<SearchResult[]> {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
  const data = await httpJson<Array<{ show: TvmazeShow }>>(url);
  const out: SearchResult[] = [];
  for (const item of data) {
    const s = item.show;
    const genres = s.genres || [];
    let cat = "مسلسل";
    if (genres.includes("Anime")) cat = "أنمي";
    else if (s.type === "Animation") cat = "كرتون";
    out.push({
      source: "tvmaze", ext_id: s.id, type: "series",
      title: s.name, year: (s.premiered || "").slice(0, 4),
      overview: stripHtml(s.summary || ""),
      poster: s.image?.medium || "",
      category: cat,
      genres: genres.join(","),
      rating: String(s.rating?.average || ""),
      studio: s.network?.name || s.webChannel?.name || "",
    });
  }
  return out;
}

export async function tvmazeDetails(r: SearchResult): Promise<SeasonT[]> {
  const eps = await httpJson<Array<{ number: number | null; season: number; name?: string }>>(
    `https://api.tvmaze.com/shows/${r.ext_id}/episodes`
  );
  const seasons = new Map<number, SeasonT["episodes"]>();
  for (const e of eps) {
    if (e.number === null) continue;
    if (!seasons.has(e.season)) seasons.set(e.season, []);
    seasons.get(e.season)!.push(newEpisode(e.number, e.name || ""));
  }
  if (!seasons.size) return [{ number: 1, episodes: [newEpisode(1)] }];
  return [...seasons.entries()].sort((a, b) => a[0] - b[0]).map(([n, eps2]) => ({ number: n, episodes: eps2.sort((a, b) => a.number - b.number) }));
}

// --- iTunes ---
interface ItunesMovie {
  trackId?: number; trackName?: string; releaseDate?: string;
  longDescription?: string; artworkUrl100?: string;
  primaryGenreName?: string; contentAdvisoryRating?: string;
}

export async function itunesSearch(q: string): Promise<SearchResult[]> {
  const url = `https://itunes.apple.com/search?media=movie&entity=movie&limit=15&term=${encodeURIComponent(q)}`;
  const data = await httpJson<{ results?: ItunesMovie[] }>(url);
  const out: SearchResult[] = [];
  for (const m of data.results || []) {
    const genre = m.primaryGenreName || "";
    out.push({
      source: "itunes", ext_id: m.trackId ?? "", type: "movie",
      title: m.trackName || "؟", year: (m.releaseDate || "").slice(0, 4),
      overview: m.longDescription || "",
      poster: (m.artworkUrl100 || "").replace("100x100", "300x300"),
      category: genre === "Anime" ? "أنمي" : "فيلم",
      genres: genre && genre !== "Anime" ? genre : "",
      classification: m.contentAdvisoryRating || "",
    });
  }
  return out;
}

// --- ويكيبيديا العربية ---
interface WikiPage {
  pageid?: number; title?: string; extract?: string; index?: number;
  thumbnail?: { source?: string; width?: number; height?: number };
  langlinks?: Array<{ "*": string; lang?: string }>;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[\W_]+/g, "");
}
function stripParen(s: string): string {
  return (s || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function wikiKind(head: string): [string, string] | null {
  const pos = (pattern: RegExp): number => {
    const m = head.match(pattern);
    return m && m.index !== undefined ? m.index : 10 ** 6;
  };
  const pMovie = pos(/فيلم|فلم/);
  const pSeries = pos(/مسلسل|سلسلة تلفزيونية|برنامج تلفزيوني/);
  if (pMovie === 10 ** 6 && pSeries === 10 ** 6) return null;
  const wtype = pMovie < pSeries ? "movie" : "series";
  if (/أنمي|أنيمي|أنمى|انمي/.test(head)) return [wtype, "أنمي"];
  if (/رسوم متحركة|رسوما متحركة|كرتون/.test(head)) return [wtype, "كرتون"];
  return [wtype, wtype === "movie" ? "فيلم" : "مسلسل"];
}

async function wikiPageQuery(term: string): Promise<WikiPage[]> {
  const params = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrsearch: term,
    gsrlimit: "15", gsrnamespace: "0", prop: "extracts|pageimages|langlinks",
    exintro: "1", explaintext: "1", exlimit: "15", exchars: "500",
    piprop: "thumbnail", pithumbsize: "300", pilimit: "15", lllang: "en", lllimit: "50", redirects: "1",
  });
  const data = await httpJson<{ query?: { pages?: Record<string, WikiPage> } }>(`https://ar.wikipedia.org/w/api.php?${params}`);
  return Object.values(data.query?.pages || {}).sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
}

export async function wikiSearchAr(q: string): Promise<SearchResult[]> {
  const terms = [q + " مسلسل", q + " فيلم", q];
  const settled = await Promise.allSettled(terms.map((t) => wikiPageQuery(t)));
  const out: SearchResult[] = [];
  const seen = new Set<number>();
  let firstErr: unknown = null;
  for (const r of settled) {
    if (r.status === "rejected") {
      firstErr = firstErr || r.reason;
      continue;
    }
    for (const p of r.value) {
      const pid = p.pageid;
      if (pid === undefined || seen.has(pid)) continue;
      const extract = (p.extract || "").trim();
      const kind = wikiKind(extract.slice(0, 250));
      if (!kind) continue;
      seen.add(pid);
      const rawTitle = p.title || "؟";
      const m = rawTitle.match(/((?:19|20)\d{2})/) || extract.slice(0, 300).match(/(?<!\d)((?:19|20)\d{2})(?!\d)/);
      let en = "";
      if (p.langlinks?.length) en = stripParen(p.langlinks[0]["*"] || "");
      out.push({
        source: "wiki", ext_id: pid, type: kind[0],
        title: stripParen(rawTitle) || rawTitle,
        year: m ? m[1] : "",
        overview: extract.slice(0, 400),
        poster: p.thumbnail?.source || "",
        category: kind[1], en,
      });
    }
  }
  if (!out.length && firstErr) throw firstErr;
  return out;
}

export async function wikiDetails(r: SearchResult): Promise<SeasonT[]> {
  const blank: SeasonT[] = [{ number: 1, episodes: [newEpisode(1)] }];
  if (r.type === "movie" || !r.en) return blank;
  try {
    const data = await httpJson<Array<{ show: TvmazeShow }>>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(r.en)}`);
    for (const item of data) {
      if (norm(item.show.name) === norm(r.en)) return tvmazeDetails({ ext_id: item.show.id });
    }
  } catch {
    /* تجاهل */
  }
  return blank;
}

// --- البحث المجمّع ---
export async function searchRaw(q: string, key: string): Promise<SearchResult[]> {
  const jobs: Array<Promise<SearchResult[]>> = [];
  if (key) jobs.push(tmdbSearch(q, key));
  jobs.push(tvmazeSearch(q), itunesSearch(q), wikiSearchAr(q));
  const settled = await Promise.allSettled(jobs);
  const lists: SearchResult[][] = [];
  for (const r of settled) if (r.status === "fulfilled") lists.push(r.value);
  return dedupeResults(lists.flat());
}

export function dedupeResults(res: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of res) {
    const k = `${normText(r.title)}|${r.type}|${r.year}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function filterResults(res: SearchResult[], flt: string): SearchResult[] {
  if (flt === "الكل") return res;
  if (flt === "أفلام") return res.filter((r) => r.type === "movie");
  if (flt === "مسلسلات") return res.filter((r) => r.type === "series" && r.category === "مسلسل");
  return res.filter((r) => r.category === flt); // أنمي / كرتون
}

export async function fetchDetails(r: SearchResult, key: string): Promise<SeasonT[]> {
  try {
    if (r.source === "tmdb" && key) return await tmdbDetails(r, key);
    if (r.source === "tvmaze") return await tvmazeDetails(r);
  } catch {
    /* رجوع فاضي */
  }
  return wikiDetails(r);
}

// --- البيانات التلقائية (Metadata) ---
interface MetaExtra {
  title?: string; alt_title?: string; year?: string; overview?: string;
  genres?: string; rating?: string; studio?: string; classification?: string;
  poster?: string; backdrop?: string;
}

function tmdbCert(d: Record<string, unknown>, kind: string): string {
  try {
    if (kind === "movie") {
      const rows = ((d.release_dates as { results?: Array<{ iso_3166_1?: string; release_dates?: Array<{ certification?: string }> }> })?.release_dates?.results || []);
      rows.sort((a, b) => (a.iso_3166_1 === "US" ? -1 : 1) - (b.iso_3166_1 === "US" ? -1 : 1));
      for (const row of rows) {
        for (const rel of row.release_dates || []) {
          if ((rel.certification || "").trim()) return rel.certification.trim();
        }
      }
    } else {
      const rows = ((d.content_ratings as { results?: Array<{ iso_3166_1?: string; rating?: string }> })?.content_ratings?.results || []);
      rows.sort((a, b) => (a.iso_3166_1 === "US" ? -1 : 1) - (b.iso_3166_1 === "US" ? -1 : 1));
      for (const row of rows) {
        if ((row.rating || "").trim()) return row.rating.trim();
      }
    }
  } catch {
    /* تجاهل */
  }
  return "";
}

async function tmdbExtra(r: SearchResult, key: string): Promise<MetaExtra> {
  const kind = r.type === "movie" ? "movie" : "tv";
  const extra = kind === "movie" ? "release_dates" : "content_ratings";
  const d = await httpJson<Record<string, unknown>>(
    `${TMDB}/${kind}/${r.ext_id}?api_key=${key}&language=ar-EG&append_to_response=${extra}`
  );
  const companies = (kind === "tv" && Array.isArray(d.networks) && (d.networks as unknown[]).length)
    ? (d.networks as Array<{ name?: string }>)
    : (d.production_companies as Array<{ name?: string }>) || [];
  const date = String(d.release_date || d.first_air_date || "");
  const genres = ((d.genres as Array<{ id?: number; name?: string }>) || [])
    .map((g) => (g.id && TMDB_GENRES[g.id]) || g.name || "")
    .filter(Boolean);
  const out: MetaExtra = {
    title: String(d.title || d.name || ""),
    alt_title: String(d.original_title || d.original_name || ""),
    year: date.slice(0, 4),
    overview: String(d.overview || ""),
    genres: [...new Set(genres)].join(","),
    rating: d.vote_average ? Number(d.vote_average).toFixed(1) : "",
    studio: companies[0]?.name || "",
    classification: tmdbCert(d, kind),
    poster: d.poster_path ? "https://image.tmdb.org/t/p/w500" + d.poster_path : "",
    backdrop: d.backdrop_path ? "https://image.tmdb.org/t/p/w780" + d.backdrop_path : "",
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as MetaExtra;
}

async function tvmazeExtra(r: SearchResult): Promise<MetaExtra> {
  const d = await httpJson<TvmazeShow & { summary?: string }>(`https://api.tvmaze.com/shows/${r.ext_id}`);
  const net = d.network || d.webChannel || {};
  const img = d.image || {};
  const out: MetaExtra = {
    overview: stripHtml(d.summary || ""),
    genres: (d.genres || []).join(","),
    rating: String(d.rating?.average || ""),
    studio: net.name || "",
    year: (d.premiered || "").slice(0, 4),
    poster: img.original || img.medium || "",
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as MetaExtra;
}

interface JikanAnime {
  title?: string; title_english?: string; title_japanese?: string;
  titles?: Array<{ title?: string }>; year?: number; aired?: { from?: string };
  synopsis?: string; genres?: Array<{ name?: string }>; score?: number;
  studios?: Array<{ name?: string }>; rating?: string;
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
}

async function jikanExtra(title: string, year = ""): Promise<MetaExtra> {
  const d = await httpJson<{ data?: JikanAnime[] }>(`https://api.jikan.moe/v4/anime?limit=5&sfw=true&q=${encodeURIComponent(title)}`);
  const nt = normText(title);
  for (const a of d.data || []) {
    const names = new Set([normText(a.title || ""), normText(a.title_english || ""), normText(a.title_japanese || "")]);
    for (const t of a.titles || []) names.add(normText(t.title || ""));
    if (!nt || !names.has(nt)) continue;
    const y = String(a.year || (a.aired?.from || "").slice(0, 4) || "");
    if (year && y && String(year) !== y) continue;
    const cert = (a.rating || "").split(" - ")[0].trim();
    const img = a.images?.jpg || {};
    const out: MetaExtra = {
      alt_title: a.title_english || a.title_japanese || "",
      year: y,
      overview: a.synopsis || "",
      genres: [...new Set((a.genres || []).map((g) => g.name || "").filter(Boolean))].join(","),
      rating: a.score ? a.score.toFixed(1) : "",
      studio: (a.studios || [])[0]?.name || "",
      classification: cert,
      poster: img.large_image_url || img.image_url || "",
    };
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as MetaExtra;
  }
  return {};
}

function bestMatch(results: SearchResult[], title: string, year = "", wtype = "", category = ""): SearchResult | null {
  const nt = normText(title);
  let best: SearchResult | null = null;
  let bestScore = 0;
  for (const r of results || []) {
    const names = new Set([normText(r.title), normText(r.alt_title || "")].filter(Boolean));
    let score = 0;
    if (names.has(nt)) score = 10;
    else {
      const close = [...names].some((n) => n.length >= 3 && (nt.includes(n) || n.includes(nt)) && Math.min(n.length, nt.length) / Math.max(n.length, nt.length) >= 0.7);
      if (!close) continue;
      score = 4;
    }
    const ry = String(r.year || "");
    if (year && ry) {
      const gap = Math.abs(parseInt(year, 10) - parseInt(ry, 10) || 0);
      const g = Number.isNaN(gap) ? (year === ry ? 0 : 9) : gap;
      score += g === 0 ? 5 : g === 1 ? 2 : -3;
    }
    if (wtype) score += r.type === wtype ? 2 : -3;
    if (category && r.category === category) score += 1;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return bestScore >= 8 ? best : null;
}

function fillMeta(dst: Record<string, string>, src?: MetaExtra | null): void {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && !dst[k]) dst[k] = v;
  }
}

const META_CACHE_TTL = 900;

export async function fetchMetadata(src: { title?: string; year?: string; type?: string; category?: string; source?: string; ext_id?: unknown }, key: string, wantSeasons = false): Promise<{ found: boolean; source: string; matched: string; fields: Record<string, string>; seasons?: SeasonT[] }> {
  const title = String(src.title || "").trim();
  const year = String(src.year || "").trim();
  const ck = JSON.stringify([normText(title), year, src.type, src.source, String(src.ext_id ?? ""), Boolean(key), wantSeasons]);
  const hit = cacheGet("meta:" + ck, META_CACHE_TTL);
  if (hit !== undefined) return hit as ReturnType<typeof fetchMetadata>;
  const hasSource = (src.source && src.ext_id !== undefined && src.ext_id !== null && src.ext_id !== "") || src.source === "wiki";
  let base: SearchResult | null = hasSource ? (src as SearchResult) : null;
  if (!base) {
    if (title.length < 2) return { found: false, source: "", matched: "", fields: {} };
    base = bestMatch(await searchRaw(title, key), title, year, src.type || "", src.category || "");
  }
  if (!base && src.category === "أنمي") {
    base = { source: "", title, year, type: (src.type as "movie" | "series") || "series", category: "أنمي" };
  }
  if (!base) {
    const res = { found: false, source: "", matched: "", fields: {} as Record<string, string> };
    return res;
  }
  const fields: Record<string, string> = {};
  for (const k of ["title", "alt_title", "year", "overview", "poster", "backdrop", "genres", "rating", "studio", "classification"] as const) {
    const v = (base as unknown as Record<string, unknown>)[k];
    if (v) fields[k] = String(v);
  }
  const jobs: Array<Promise<void>> = [];
  const extras: Array<{ name: string; data: MetaExtra }> = [];
  let seasons: SeasonT[] | undefined;
  if (base.source === "tmdb" && key && base.ext_id !== undefined) {
    jobs.push(tmdbExtra(base, key).then((d) => extras.push({ name: "tmdb", data: d })).catch(() => extras.push({ name: "tmdb", data: null })));
  } else if (base.source === "tvmaze") {
    jobs.push(tvmazeExtra(base).then((d) => extras.push({ name: "tvmaze", data: d })).catch(() => extras.push({ name: "tvmaze", data: null })));
  }
  if ((src.category || base.category) === "أنمي") {
    jobs.push(jikanExtra(base.title || title, base.year || year).then((d) => extras.push({ name: "jikan", data: d })).catch(() => extras.push({ name: "jikan", data: null })));
  }
  if (wantSeasons && base.source) {
    jobs.push(fetchDetails(base, key).then((s) => { seasons = s; }).catch(() => { seasons = undefined; }));
  }
  await Promise.all(jobs);
  for (const n of ["tmdb", "tvmaze", "jikan"]) {
    fillMeta(fields, extras.find((e) => e.name === n)?.data);
  }
  const res = {
    found: Object.keys(fields).length > 0,
    source: base.source || (extras.some((e) => e.name === "jikan" && e.data) ? "jikan" : ""),
    matched: `${base.title || title} (${fields.year || base.year || "؟"})`,
    fields,
    ...(seasons ? { seasons } : {}),
  };
  if (res.found) cachePut("meta:" + ck, res);
  return res;
}

// --- البحث عن صور ---
const IMG_RESULTS_MAX = 72;

function imgItem(url: string, thumb: string, title: string, source: string, w = 0, h = 0): ImageResult {
  return { url, thumb: thumb || url, title: title || "", source, w: Math.trunc(w || 0), h: Math.trunc(h || 0) };
}

async function imgTmdb(q: string, key: string, kind: string): Promise<ImageResult[]> {
  const out: ImageResult[] = [];
  const top = (await tmdbSearch(q, key)).filter((r) => r.poster || r.backdrop).slice(0, 4);
  const settled = await Promise.allSettled(
    top.map(async (r) => {
      const path = r.type === "movie" ? "movie" : "tv";
      const d = await httpJson<{ posters?: Array<{ file_path: string; width?: number; height?: number }>; backdrops?: Array<{ file_path: string; width?: number; height?: number }> }>(
        `${TMDB}/${path}/${r.ext_id}/images?api_key=${key}&include_image_language=ar,en,null`
      );
      const field = kind === "poster" ? "posters" : "backdrops";
      const [big, small] = kind === "poster" ? ["w500", "w185"] : ["w780", "w300"];
      return (d[field] || []).slice(0, 8).map((p) =>
        imgItem(`https://image.tmdb.org/t/p/${big}${p.file_path}`, `https://image.tmdb.org/t/p/${small}${p.file_path}`, r.title, "TMDB", p.width, p.height)
      );
    })
  );
  for (const s of settled) if (s.status === "fulfilled") out.push(...s.value);
  return out;
}

async function imgTvmaze(q: string, kind: string): Promise<ImageResult[]> {
  const out: ImageResult[] = [];
  const shows = (await httpJson<Array<{ show: TvmazeShow }>>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`)).slice(0, 6);
  if (kind === "poster") {
    for (const item of shows) {
      const img = item.show.image || {};
      if (img.original) out.push(imgItem(img.original, img.medium || "", item.show.name, "TVmaze"));
    }
    return out;
  }
  const settled = await Promise.allSettled(
    shows.slice(0, 3).map(async (item) => {
      const res: ImageResult[] = [];
      const ims = await httpJson<Array<{ type?: string; resolutions?: Record<string, { url?: string; width?: number; height?: number }> }>>(
        `https://api.tvmaze.com/shows/${item.show.id}/images`
      );
      for (const im of ims) {
        if (im.type === "background") {
          const o = im.resolutions?.original || {};
          if (o.url) res.push(imgItem(o.url, im.resolutions?.medium?.url || "", item.show.name, "TVmaze", o.width, o.height));
        }
      }
      return res.slice(0, 4);
    })
  );
  for (const s of settled) if (s.status === "fulfilled") out.push(...s.value);
  return out;
}

async function imgItunes(q: string): Promise<ImageResult[]> {
  const url = `https://itunes.apple.com/search?media=movie&entity=movie&limit=12&term=${encodeURIComponent(q)}`;
  const data = await httpJson<{ results?: ItunesMovie[] }>(url);
  const out: ImageResult[] = [];
  for (const m of data.results || []) {
    const art = m.artworkUrl100 || "";
    if (art) {
      out.push(imgItem(art.replace("100x100bb", "600x600bb").replace("100x100", "600x600"), art.replace("100x100bb", "300x300bb").replace("100x100", "300x300"), m.trackName || "", "iTunes"));
    }
  }
  return out;
}

async function imgWikipedia(q: string): Promise<ImageResult[]> {
  const lang = hasArabic(q) ? "ar" : "en";
  const params = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrsearch: q,
    gsrlimit: "12", gsrnamespace: "0", prop: "pageimages", piprop: "thumbnail",
    pithumbsize: "500", pilimit: "12",
  });
  const data = await httpJson<{ query?: { pages?: Record<string, WikiPage> } }>(`https://${lang}.wikipedia.org/w/api.php?${params}`);
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  const out: ImageResult[] = [];
  for (const p of pages) {
    const th = p.thumbnail || {};
    if (th.source) out.push(imgItem(th.source, th.source, p.title || "", "Wikipedia", th.width, th.height));
  }
  return out;
}

async function imgCommons(q: string, kind: string): Promise<ImageResult[]> {
  const params = new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: q + (kind === "poster" ? " poster" : ""), gsrnamespace: "6", gsrlimit: "16",
    prop: "imageinfo", iiprop: "url|size|mime", iiurlwidth: "500",
  });
  const data = await httpJson<{ query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ mime?: string; thumburl?: string; thumbwidth?: number; thumbheight?: number }> }> } }>(
    `https://commons.wikimedia.org/w/api.php?${params}`
  );
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  const out: ImageResult[] = [];
  for (const p of pages) {
    for (const ii of p.imageinfo || []) {
      if (["image/jpeg", "image/png", "image/webp"].includes(ii.mime || "") && ii.thumburl) {
        const title = (p.title || "").replace(/^(File|ملف):/, "");
        out.push(imgItem(ii.thumburl, ii.thumburl, title, "Commons", ii.thumbwidth, ii.thumbheight));
      }
    }
  }
  return out;
}

export async function imageSearch(q: string, key = "", kind = "poster"): Promise<{ items: ImageResult[]; failed: string[] }> {
  q = (q || "").trim();
  if (!q) return { items: [], failed: [] };
  const ck = `img:${normText(q)}:${kind}:${Boolean(key)}`;
  const cached = cacheGet(ck, 900);
  if (cached !== undefined) return cached as { items: ImageResult[]; failed: string[] };
  const jobs: Array<{ name: string; fn: Promise<ImageResult[]> }> = [];
  if (key) jobs.push({ name: "TMDB", fn: imgTmdb(q, key, kind) });
  jobs.push({ name: "TVmaze", fn: imgTvmaze(q, kind) });
  if (kind === "poster") {
    jobs.push({ name: "iTunes", fn: imgItunes(q) });
    jobs.push({ name: "Wikipedia", fn: imgWikipedia(q) });
  }
  jobs.push({ name: "Commons", fn: imgCommons(q, kind) });
  const settled = await Promise.allSettled(jobs.map((j) => j.fn));
  const lists: ImageResult[][] = [];
  const failed: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") lists.push(s.value);
    else failed.push(jobs[i].name);
  });
  const out: ImageResult[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (out.length < IMG_RESULTS_MAX && lists.some((l) => i < l.length)) {
    for (const l of lists) {
      if (i < l.length && !seen.has(l[i].url)) {
        seen.add(l[i].url);
        out.push(l[i]);
      }
    }
    i += 1;
  }
  const res = { items: out, failed };
  if (out.length || !failed.length) cachePut(ck, res); // متخزنش فشل كامل
  return res;
}

// --- فحص اللينكات أونلاين ---
export type CheckStatus = "ok" | "warn" | "dead";

export async function checkUrl(url: string, timeout = 12000): Promise<{ status: CheckStatus; msg: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(timeout),
      redirect: "follow",
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403 || res.status === 405 || res.status === 429 || res.status === 451) {
      return { status: "warn", msg: `HTTP ${res.status} (الموقع بيمنع الفحص الآلي - جرّبه بإيدك بزرار ▶)` };
    }
    if (res.ok) return { status: "ok", msg: `HTTP ${res.status}` };
    return { status: "dead", msg: `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "dead", msg: msg.slice(0, 80) };
  }
}

export async function checkMany(urls: string[], workers = 8): Promise<Array<{ status: CheckStatus; msg: string }>> {
  const results: Array<{ status: CheckStatus; msg: string }> = new Array(urls.length);
  let idx = 0;
  const worker = async (): Promise<void> => {
    while (idx < urls.length) {
      const i = idx++;
      results[i] = await checkUrl(urls[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(workers, urls.length || 1) }, worker));
  return results;
}
