// استخراج حلقات وسيرفرات الموسم من صفحة موقع — نسخة سيرفر من scraper.py
// نفس المنطق: لينكات الحلقات من صفحة الموسم، وبعدين iframes/عناصر السيرفرات من صفحة المشاهدة
import type { ScrapeResult, SeasonT, EpisodeT } from "../types";
import { validUrl, newEpisode, setEpisodeServers, episodeServers, episodeRawServers, normalizeUrl } from "../urls";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const SEASON_TIMEOUT = 20000;
export const EPISODE_TIMEOUT = 10000;
const MAX_BYTES = 8 * 1024 * 1024;
const SERVER_CLASS_RE = /server|watch|play|embed/i;
const EP_HREF_RE = /episode|ep-?\d+/i;
const SKIP_TITLES = ["احدث الحلقات"];
const SKIP_WORDS = ["التالية", "السابقة"];
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

export interface LogLine {
  kind: "info" | "ok" | "warn" | "error";
  msg: string;
  current: number;
  total: number;
}

export class ScrapeCancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

function cleanText(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

async function fetchPage(url: string, timeout: number): Promise<{ status: number; html: string; finalUrl: string }> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout), redirect: "follow", cache: "no-store" });
  if (!res.ok) return { status: res.status, html: "", finalUrl: url };
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("الصفحة كبيرة قوي");
  const ct = res.headers.get("Content-Type") || "";
  let charset = "utf-8";
  const m = ct.match(/charset=([\w\-]+)/i);
  if (m) charset = m[1];
  let html: string;
  try {
    html = new TextDecoder(charset).decode(buf);
  } catch {
    html = new TextDecoder("utf-8").decode(buf);
  }
  return { status: res.status, html, finalUrl: res.url || url };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x?([0-9a-fA-F]+);/g, (all, num) => {
      try {
        const code = all.toLowerCase().startsWith("&#x") ? parseInt(num, 16) : parseInt(num, 10);
        return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
      } catch {
        return all;
      }
    });
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = attrs.match(re);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
}

// ---------------------------------------------------------------------------
// تحليل HTML خفيف (زي HTMLParser في بايثون): <a> بنصها، <iframe src>، عناصر السيرفرات
// ---------------------------------------------------------------------------
interface ParsedPage {
  anchors: Array<{ href: string; text: string }>;
  iframes: string[];
  serverEls: Array<string | null>;
}

export function parsePage(html: string): ParsedPage {
  const anchors: Array<{ href: string; text: string }> = [];
  const iframes: string[] = [];
  const serverEls: Array<string | null> = [];
  const openA: Array<{ href: string; parts: string[] }> = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][^\s>/]*)(("[^"]*"|'[^']*'|[^>])*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const flushText = (chunk: string): void => {
    if (chunk && openA.length) for (const a of openA) a.parts.push(chunk);
  };
  while ((m = re.exec(html)) !== null) {
    flushText(html.slice(last, m.index));
    last = re.lastIndex;
    const isEnd = m[1] === "/";
    const tag = m[2].toLowerCase();
    let attrs = m[3] || "";
    const selfClose = /\/\s*$/.test(attrs);
    attrs = attrs.replace(/\/\s*$/, "");
    if (tag === "script" || tag === "style") {
      // زي CDATA في HTMLParser: المحتوى نص ومفيش تاجات جواه بتتحلل
      const closeRe = new RegExp(`</${tag}\\s*>`, "i");
      const rest = html.slice(last);
      const cm = rest.match(closeRe);
      if (cm && cm.index !== undefined) {
        flushText(rest.slice(0, cm.index));
        last = last + cm.index + cm[0].length;
        re.lastIndex = last;
      }
      continue;
    }
    if (isEnd) {
      if (tag === "a" && openA.length) {
        const a = openA.pop()!;
        anchors.push({ href: a.href, text: a.parts.join("") });
      }
      continue;
    }
    if (tag === "iframe") {
      const src = getAttr(attrs, "src") || getAttr(attrs, "data-src");
      if (src) iframes.push(src);
    }
    if (["a", "li", "button", "div"].includes(tag)) {
      const cls = getAttr(attrs, "class") || "";
      if (SERVER_CLASS_RE.test(cls) || cls.split(/\s+/).some((c) => c && SERVER_CLASS_RE.test(c))) {
        serverEls.push(getAttr(attrs, "data-url") || getAttr(attrs, "data-link") || getAttr(attrs, "href"));
      }
    }
    if (tag === "a") {
      const href = getAttr(attrs, "href");
      if (href !== null) openA.push({ href, parts: [] });
    }
    if (VOID_TAGS.has(tag) || selfClose) {
      /* تاج فاضي */
    }
  }
  flushText(html.slice(last));
  while (openA.length) {
    // <a> مقفولتش — نفس سلوك close() في بايثون
    const a = openA.pop()!;
    anchors.push({ href: a.href, text: a.parts.join("") });
  }
  return { anchors, iframes, serverEls };
}

export function episodeNo(title: string): number | null {
  const m1 = (title || "").match(/الحلقة\s*(\d+)/);
  if (m1) return parseInt(m1[1], 10);
  const m2 = (title || "").match(/^\d+$/);
  return m2 ? parseInt(m2[0], 10) : null;
}

export function findEpisodeLinks(html: string, baseUrl: string): Array<{ title: string; link: string }> {
  const out: Array<{ title: string; link: string }> = [];
  const seen = new Set<string>();
  for (const { href, text: rawText } of parsePage(html).anchors) {
    const abs = urlJoin(baseUrl, href);
    const text = cleanText(rawText);
    if (abs.includes("/category/")) continue;
    if (text.includes("الحلقة") || EP_HREF_RE.test(abs)) {
      if (!text || SKIP_TITLES.includes(text) || text.length >= 50) continue;
      if (SKIP_WORDS.some((w) => text.includes(w))) continue;
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push({ title: text, link: abs });
    }
  }
  return out;
}

export function sortUnique(items: Array<{ title: string; link: string }>): Array<{ title: string; link: string }> {
  const sorted = [...items].sort((a, b) => {
    const na = episodeNo(a.title);
    const nb = episodeNo(b.title);
    return (na === null ? 1 : 0) - (nb === null ? 1 : 0) || (na || 0) - (nb || 0);
  });
  const out: Array<{ title: string; link: string }> = [];
  const used = new Set<number>();
  for (const ep of sorted) {
    const n = episodeNo(ep.title);
    if (n !== null) {
      if (used.has(n)) continue;
      used.add(n);
    }
    out.push(ep);
  }
  return out;
}

export function watchUrl(link: string): string {
  if (link.endsWith("watch/") || link.endsWith("watch")) return link;
  return link.replace(/\/$/, "") + "/watch/";
}

export function findServers(html: string, pageUrl: string): string[] {
  const page = parsePage(html);
  const servers: string[] = [];
  for (const src of page.iframes) {
    const abs = urlJoin(pageUrl, src);
    if (!servers.includes(abs)) servers.push(abs);
  }
  for (const s of page.serverEls) {
    if (s && s.startsWith("http") && !servers.includes(s)) servers.push(s);
  }
  return servers;
}

function urlJoin(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href || base;
  }
}

export function uniqueNumbers(results: ScrapeResult[]): ScrapeResult[] {
  const used = new Set<number>();
  const out: ScrapeResult[] = [];
  for (const r of results) {
    let n = r.episode_number;
    if (used.has(n)) {
      n = Math.max(...used) + 1;
      r.episode_number = n;
    }
    used.add(n);
    out.push(r);
  }
  return out;
}

export async function scrapeSeason(url: string, progress?: (line: LogLine) => void, isCancelled?: () => boolean): Promise<ScrapeResult[]> {
  const say = (kind: LogLine["kind"], msg: string, current = 0, total = 0): void => {
    progress?.({ kind, msg, current, total });
  };
  const cancelled = (): boolean => Boolean(isCancelled?.());
  say("info", `بتصل بالصفحة: ${url}`);
  let page: { status: number; html: string; finalUrl: string };
  try {
    page = await fetchPage(url, SEASON_TIMEOUT);
  } catch (e) {
    throw new Error(explainError(e));
  }
  if (page.status !== 200) throw new Error(`فشل الاتصال بالموقع، كود: ${page.status}`);
  if (cancelled()) throw new ScrapeCancelled();
  const eps = sortUnique(findEpisodeLinks(page.html, page.finalUrl || url));
  const total = eps.length;
  if (!total) {
    say("warn", "ملقيتش أي حلقات في الصفحة دي. اتأكد إن الرابط هو صفحة الموسم (اللي فيها لينكات الحلقات).", 0, 0);
    return [];
  }
  say("info", `لقيت ${total} حلقة. بجمع السيرفرات...`, 0, total);

  const results: ScrapeResult[] = [];
  let index = 0;
  for (const ep of eps) {
    index += 1;
    if (cancelled()) throw new ScrapeCancelled();
    const link = watchUrl(ep.link);
    let servers: string[] = [];
    try {
      const p = await fetchPage(link, EPISODE_TIMEOUT);
      if (p.status === 200) {
        servers = findServers(p.html, p.finalUrl || link);
      } else {
        say("warn", `${ep.title}: الصفحة رجّعت كود ${p.status}`, index, total);
      }
    } catch (e) {
      // حلقة واحدة بتفشل متوقفش الباقي
      say("error", `خطأ في الحلقة ${index}: ${explainError(e)}`, index, total);
    }
    results.push({ episode_number: episodeNo(ep.title) ?? index, title: ep.title, servers });
    say(servers.length ? "ok" : "warn", `${ep.title} (السيرفرات: ${servers.length})`, index, total);
  }
  return uniqueNumbers(results);
}

export function explainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/timeout|timed?|abort/i.test(msg)) return "الموقع اتأخر في الرد";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|EAI_AGAIN/i.test(msg)) return "مقدرتش أوصل للموقع. اتأكد من الرابط ومن الإنترنت";
  if (/Invalid URL|invalid/i.test(msg)) return "الرابط مش صحيح";
  return msg.slice(0, 120) || "خطأ غير معروف";
}

export function cleanScrapeUrl(text: string): string {
  const u = (text || "").trim();
  if (!u || u.includes(" ")) return "";
  const full = /^https?:\/\//i.test(u) ? u : "https://" + u;
  return validUrl(full) ? full : "";
}

// ---------------------------------------------------------------------------
// تطبيق النتايج على موسم (نفس apply_to_season)
// ---------------------------------------------------------------------------
const PLAIN_LABEL_RE = /^\s*(?:ال)?حلقة\s*\d+\s*$|^\s*\d+\s*$/;

function specialTitle(title: string): string {
  const t = cleanText(title);
  return PLAIN_LABEL_RE.test(t) ? "" : t;
}

export interface ApplyStat {
  episodes: number;
  created: number;
  serversAdded: number;
  titles: number;
}

export function applyToSeason(season: SeasonT, results: ScrapeResult[], replace = false, useTitles = false): ApplyStat {
  const byNum = new Map<number, EpisodeT>(season.episodes.map((e) => [e.number, e]));
  const stat: ApplyStat = { episodes: 0, created: 0, serversAdded: 0, titles: 0 };
  for (const r of results) {
    const urls = (r.servers || []).filter(Boolean);
    const title = useTitles ? specialTitle(r.title) : "";
    if (!urls.length && !title) continue;
    const num = Math.trunc(r.episode_number);
    let ep = byNum.get(num);
    if (!ep) {
      ep = newEpisode(num);
      season.episodes.push(ep);
      byNum.set(num, ep);
      stat.created += 1;
    }
    const before = new Set(episodeRawServers(ep).map((s) => normalizeUrl(s.url)));
    if (urls.length) {
      const old = replace ? [] : episodeRawServers(ep); // الموجود بيفضل زي ما كُتب
      const known = new Set(old.map((s) => normalizeUrl(s.url)));
      const merged = [...old];
      for (const u of urls) {
        const k = normalizeUrl(u);
        if (!known.has(k)) {
          known.add(k);
          merged.push({ url: u, name: "" });
        }
      }
      setEpisodeServers(ep, merged);
      const after = episodeServers(ep, true).map((s) => normalizeUrl(s.url));
      stat.serversAdded += after.filter((u) => !before.has(u)).length;
    }
    if (title && !(ep.title || "").trim()) {
      ep.title = title;
      stat.titles += 1;
    }
    stat.episodes += 1;
  }
  season.episodes.sort((a, b) => a.number - b.number);
  return stat;
}
