// نسخة خفيفة من _raw_servers للبصمة (من غير استيراد دائري مع urls.ts)
import type { EpisodeT, ServerT } from "./types";
import { extractUrls, normalizeUrl, splitLinks } from "./urls";

function uniqueNorm(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean).map(normalizeUrl))];
}

function cleanServers(raw: unknown): ServerT[] {
  const out: ServerT[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
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

export function rawServersGuard(ep: EpisodeT): { servers: ServerT[]; fromServers: boolean } {
  const link = String(ep.link || "");
  if (Array.isArray(ep.servers)) {
    const servers = cleanServers(ep.servers);
    const inSync = JSON.stringify(splitLinks(link)) === JSON.stringify(uniqueNorm(servers.map((x) => x.url)));
    if (inSync || servers.some((x) => x.name || x.enabled === false)) return { servers, fromServers: true };
  }
  let servers: ServerT[] = link.trim() ? extractUrls(link).map((u) => ({ name: "", url: u })) : [];
  if (link.trim() && !servers.length) servers = [{ url: link.trim(), name: "" }];
  const seen = new Map<string, ServerT>();
  const dedup: ServerT[] = [];
  for (const s of servers) {
    const k = normalizeUrl(s.url);
    if (seen.has(k)) continue;
    seen.set(k, s);
    dedup.push(s);
  }
  return { servers: dedup, fromServers: false };
}
