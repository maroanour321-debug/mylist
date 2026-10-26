// توحيد النص العربي للبحث + اللصق الذكي — نفس منطق core.py
import { extractUrls, normalizeUrl, newEpisode, setEpisodeServers, episodeServers } from "./urls";
import type { EpisodeT, SeasonT, ServerT } from "./types";

const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const AR_FOLD: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي" };
const AR_MARKS = /[\u064B-\u065F\u0670\u0640]/g;

export function translateDigits(s: string): string {
  return (s || "").replace(/[٠-٩]/g, (d) => AR_DIGITS[d] || d);
}

export function normText(s: string): string {
  const t = String(s || "")
    .toLowerCase()
    .replace(AR_MARKS, "")
    .replace(/[أإآىةؤئ]/g, (c) => AR_FOLD[c] || c)
    .replace(/[٠-٩]/g, (d) => AR_DIGITS[d] || d);
  return t.replace(/\s+/g, " ").trim();
}

/** كل كلمة في البحث لازم تبقى موجودة في النص (بأي ترتيب) */
export function textMatches(queryNorm: string, hayNorm: string): boolean {
  return queryNorm.split(" ").every((tok) => tok && hayNorm.includes(tok));
}

export function hasArabic(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s || "");
}

// "حلقة 5" / "EP05" / "ح5" / "#5" ...
export const EP_LABEL_RE = /(?<!\w)(?:(?:ال)?حلقة|episode|ep|e|ح)\.?\s*[:#\-]?\s*(?:رقم\s*)?0*(\d+)|#\s*0*(\d+)/i;

/**
 * اللصق الذكي: لو قدّام اللينك رقم حلقة بيروح ليها (وكذا لينك = كذا سيرفر)،
 * ولو مفيش رقم بيوزّع بالترتيب. سطر فاضي بيفصل المجموعات، وسطر «حلقة 5» لوحده
 * معناه إن اللينكات اللي تحته لنفس الحلقة. بيرجع (عدد الحلقات اللي اتملت، هل لقى أرقام).
 */
export function fillSmart(season: SeasonT, text: string, start = 1): { filled: number; numbered: boolean } {
  const t = translateDigits(text || "");
  const byNum = new Map<number, EpisodeT>(season.episodes.map((e) => [e.number, e]));
  const entries: Array<{ num: number; urls: string[] }> = [];
  let block: number | null = null;
  let seq = start;
  let numbered = false;

  for (const line of t.split(/\r?\n/)) {
    if (!line.trim()) {
      block = null; // سطر فاضي بينهي مجموعة الحلقة
      continue;
    }
    const urls = extractUrls(line);
    const noUrl = line.replace(URL_SUB, " ");
    const m = noUrl.match(EP_LABEL_RE);
    const num = m ? parseInt(m[1] || m[2], 10) : null;
    if (!urls.length) {
      if (num !== null) block = num; // سطر «حلقة 5» لوحده
      continue;
    }
    if (num !== null) {
      numbered = true;
      entries.push({ num, urls });
      seq = num + 1;
      block = null;
    } else if (block !== null) {
      numbered = true;
      const found = entries.find((e) => e.num === block);
      if (found) found.urls.push(...urls);
      else entries.push({ num: block, urls: [...urls] });
      seq = block + 1;
    } else {
      for (const u of urls) {
        entries.push({ num: seq, urls: [u] });
        seq += 1;
      }
    }
  }

  for (const { num, urls } of entries) {
    let ep = byNum.get(num);
    if (!ep) {
      ep = newEpisode(num);
      season.episodes.push(ep);
      byNum.set(num, ep);
    }
    const prev = new Map<string, ServerT>(episodeServers(ep, true).map((x) => [normalizeUrl(x.url), x]));
    const newSrv: ServerT[] = [];
    for (const u of urls) {
      const srv: ServerT = { url: u, name: "" };
      const old = prev.get(normalizeUrl(u));
      if (old) {
        srv.name = old.name || "";
        if (old.enabled === false) srv.enabled = false;
      }
      newSrv.push(srv);
    }
    setEpisodeServers(ep, newSrv);
  }
  season.episodes.sort((a, b) => a.number - b.number);
  return { filled: entries.length, numbered };
}

const URL_SUB = /https?:\/\/[^\s"'<>]+/gi;
