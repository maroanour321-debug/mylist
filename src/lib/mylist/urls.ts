// تنظيف اللينكات وتحويلها لصيغة embed — نفس قواعد core.py بالظبط
import type { EpisodeT, ServerT } from "./types";

export const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

export function extractUrls(text: string): string[] {
  const t = text || "";
  const m = t.match(URL_RE);
  return m ? m : [];
}

// قواعد التحويل التلقائي: ok.ru, yourupload, uqload, YouTube, Google Drive,
// streamtape, dood, mixdrop, mp4upload, dailymotion
const EMBED_RULES: Array<[RegExp, string]> = [
  [/^(https?:\/\/(?:www\.)?ok\.ru)\/video\/(\d+)/i, "$1/videoembed/$2"],
  [/^(https?:\/\/(?:www\.)?yourupload\.com)\/watch\/(\w+)/i, "$1/embed/$2"],
  [/^(https?:\/\/(?:www\.)?uqload\.\w+)\/(\w+)\.html$/i, "$1/embed-$2.html"],
  [/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:\S*&)?v=([\w-]{6,})\S*$/i, "https://www.youtube.com/embed/$1"],
  [/^https?:\/\/youtu\.be\/([\w-]{6,})\S*$/i, "https://www.youtube.com/embed/$1"],
  [/^(https?:\/\/drive\.google\.com)\/file\/d\/([\w-]+)\/(?:view|edit)\S*$/i, "$1/file/d/$2/preview"],
  [/^(https?:\/\/(?:www\.)?streamtape\.\w+)\/v\/(\w+)\S*$/i, "$1/e/$2"],
  [/^(https?:\/\/(?:www\.)?dood\w*\.\w+)\/d\/(\w+)\S*$/i, "$1/e/$2"],
  [/^(https?:\/\/(?:www\.)?mixdrop\.\w+)\/f\/(\w+)\S*$/i, "$1/e/$2"],
  [/^(https?:\/\/(?:www\.)?mp4upload\.com)\/(\w+)(?:\.html)?$/i, "$1/embed-$2.html"],
  [/^(https?:\/\/(?:www\.)?dailymotion\.com)\/video\/(\w+)\S*$/i, "$1/embed/video/$2"],
];

export function normalizeUrl(u: string): string {
  let s = (u || "").trim();
  if (s.startsWith("//")) s = "https:" + s;
  else if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  for (const [pat, repl] of EMBED_RULES) {
    if (pat.test(s)) {
      const next = s.replace(pat, repl);
      if (next !== s) return next;
    }
  }
  return s;
}

export function splitLinks(text: string): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  const urls = extractUrls(t);
  const list = urls.length ? urls : [t];
  return [...new Set(list.map(normalizeUrl))]; // من غير تكرار
}

export function validUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return (p.protocol === "http:" || p.protocol === "https:") && p.hostname.includes(".") && !u.includes(" ");
  } catch {
    return false;
  }
}

export function serverName(url: string): string {
  try {
    const u = url.includes("//") ? url : "//" + url;
    let host = new URL(u).hostname.toLowerCase().split(":")[0];
    const parts = host.split(".").filter((p) => p && p !== "www");
    if (parts.length >= 2) return parts[parts.length - 2];
    return parts[0] || "server";
  } catch {
    return "server";
  }
}

// ---------------------------------------------------------------------------
// سيرفرات الحلقة: servers هو الأصل، و link بيتزامن تلقائياً (لينكات بمسافة)
// ---------------------------------------------------------------------------
function uniqueNorm(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean).map(normalizeUrl))];
}

function cleanServers(raw: unknown): ServerT[] {
  const out: ServerT[] = [];
  const items = Array.isArray(raw) ? raw : [];
  for (const item of items) {
    let obj: { name?: string; url?: string; enabled?: boolean } | null = null;
    if (typeof item === "string") obj = { url: item };
    else if (item && typeof item === "object") obj = item as { name?: string; url?: string; enabled?: boolean };
    if (!obj) continue;
    const name = String(obj.name || "").trim();
    const text = String(obj.url || "").trim();
    const urls = extractUrls(text);
    const list = urls.length ? urls : text ? [text] : [];
    list.forEach((u, k) => {
      const srv: ServerT = { name: k === 0 ? name : "", url: u.trim() };
      if (obj!.enabled === false) srv.enabled = false;
      out.push(srv);
    });
  }
  return out;
}

function dedupeServers(servers: ServerT[]): ServerT[] {
  const seen = new Map<string, ServerT>();
  const out: ServerT[] = [];
  for (const s of servers) {
    const k = normalizeUrl(s.url);
    const found = seen.get(k);
    if (found) {
      if (s.name && !found.name) found.name = s.name;
      continue;
    }
    seen.set(k, s);
    out.push(s);
  }
  return out;
}

/** السيرفرات الخام: لو حد عدّل link لوحده ومفيش أسماء/مقفولين هتضيع، بنتبع link */
function rawServers(ep: EpisodeT): { servers: ServerT[]; fromServers: boolean } {
  const link = String(ep.link || "");
  if (Array.isArray(ep.servers)) {
    const servers = cleanServers(ep.servers);
    const inSync = JSON.stringify(splitLinks(link)) === JSON.stringify(uniqueNorm(servers.map((x) => x.url)));
    if (inSync || servers.some((x) => x.name || x.enabled === false)) return { servers, fromServers: true };
  }
  let servers: ServerT[] = link.trim() ? extractUrls(link).map((u) => ({ name: "", url: u })) : [];
  if (link.trim() && !servers.length) servers = [{ url: link.trim(), name: "" }];
  return { servers: dedupeServers(servers), fromServers: false };
}

/** بيبني servers من link القديم ويزامن link. آمن أكتر من مرة. */
export function migrateEpisode(ep: EpisodeT): EpisodeT {
  const { servers, fromServers } = rawServers(ep);
  if (fromServers && JSON.stringify(splitLinks(String(ep.link || ""))) !== JSON.stringify(uniqueNorm(servers.map((x) => x.url)))) {
    ep.link = servers.map((x) => x.url).join(" ");
  }
  ep.servers = servers;
  if (ep.link === undefined) ep.link = "";
  return ep;
}

export function newEpisode(n: number, title = "", link = "", servers?: ServerT[]): EpisodeT {
  const ep: EpisodeT = { number: n, title, link: link || "", servers: [] };
  if (servers) setEpisodeServers(ep, servers);
  else migrateEpisode(ep);
  return ep;
}

/** المكان الوحيد اللي بيكتب سيرفرات الحلقة: بينضّف، بيشيل التكرار، ويزامن link */
export function setEpisodeServers(ep: EpisodeT, servers: ServerT[]): ServerT[] {
  const clean = dedupeServers(cleanServers(servers));
  ep.servers = clean;
  ep.link = clean.map((s) => s.url).join(" ");
  return clean;
}

/** سيرفرات الحلقة بالترتيب (embed، من غير تكرار). includeDisabled = كمان المقفولة */
export function episodeServers(ep: EpisodeT, includeDisabled = false): ServerT[] {
  const raw = rawServers(ep).servers;
  const out: ServerT[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    const url = normalizeUrl(s.url);
    const enabled = s.enabled !== false;
    if (seen.has(url) || (!enabled && !includeDisabled)) continue;
    seen.add(url);
    out.push({ name: s.name || "", url, enabled });
  }
  return out;
}

/** السيرفرات زي ما هي متخزنة (اللينك الخام + المقفول) — للإضافة عليها بأمان */
export function episodeRawServers(ep: EpisodeT): ServerT[] {
  return rawServers(ep).servers.map((s) => ({ ...s }));
}

/** كل لينكات الحلقة اللي هتتصدّر (من غير المقفول والتكرار) */
export function episodeLinks(ep: EpisodeT): string[] {
  return episodeServers(ep).map((s) => s.url);
}

export function episodeHasLink(ep: EpisodeT): boolean {
  return episodeLinks(ep).length > 0;
}

export function serverLabel(sv: ServerT): string {
  return sv.name || serverName(sv.url);
}

export function serversSummary(ep: EpisodeT): string {
  const svs = episodeServers(ep, true);
  if (!svs.length) return "من غير سيرفرات";
  const names = svs.map((x) => serverLabel(x) + (x.enabled === false ? " (مقفول)" : ""));
  const head = svs.length === 1 ? "سيرفر واحد" : `${svs.length} سيرفرات`;
  const shown = names.slice(0, 3).join(" · ") + (names.length > 3 ? ` · +${names.length - 3}` : "");
  return `${head}: ${shown}`;
}
