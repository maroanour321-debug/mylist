// بصمة العمل — متوافقة 100% مع برنامج سطح المكتب (json.dumps + md5)
// عشان الأعمال المستوردة من ملف JSON القديم تفضل «متصدّرة» مش «معدّلة»
import md5 from "js-md5";
import type { EpisodeT, Work, ExportState } from "./types";
import { rawServersGuard } from "./siglink";

/** نسخة JS من json.dumps(obj, ensure_ascii=False, sort_keys=True) بالفواصل الافتراضية */
export function pyJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  const t = typeof obj;
  if (t === "boolean") return obj ? "true" : "false";
  if (t === "number") return Number.isFinite(obj) ? String(obj) : "null";
  if (t === "string") return pyJsonString(obj);
  if (Array.isArray(obj)) return "[" + obj.map(pyJsonStringify).join(", ") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => pyJsonString(k) + ": " + pyJsonStringify((obj as Record<string, unknown>)[k])).join(", ") + "}";
}

function pyJsonString(s: string): string {
  let out = '"';
  for (const ch of s) {
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if ((ch.codePointAt(0) || 0) < 0x20) out += "\\u" + (ch.codePointAt(0) || 0).toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}

const SIG_FIELDS = ["title", "altTitle", "hub", "type", "year", "rating", "studio", "genres", "classification", "poster", "backdrop"] as const;

// أسماء الحقول بصيغة بايثون (SIG_FIELDS الأصلي)
const PY_SIG_FIELDS = ["title", "alt_title", "hub", "type", "year", "rating", "studio", "genres", "classification", "poster", "backdrop"] as const;

function sigLink(e: EpisodeT): string | string[][] {
  // نفس بصمة زمان لو مفيش اسم ولا سيرفر مقفول (عشان الأعمال القديمة متبقاش "معدّلة")
  const { servers, fromServers } = rawServersGuard(e);
  if (fromServers && servers.some((x) => x.name || x.enabled === false)) {
    return servers.map((x) => [x.name || "", x.url, x.enabled !== false]);
  }
  return String(e.link || "").trim();
}

/** بصمة محتوى العمل — نفس md5 بتاع البرنامج الأصلي بالبايت */
export function workSignature(w: Work): string {
  const data: Record<string, unknown> = {};
  PY_SIG_FIELDS.forEach((k, i) => {
    data[k] = String((w as unknown as Record<string, unknown>)[SIG_FIELDS[i]] || "");
  });
  if (w.posterLocal) data["poster_local"] = String(w.posterLocal);
  data["seasons"] = w.seasons.map((s) => [
    s.number,
    s.episodes.map((e) => [e.number, e.title || "", sigLink(e)]),
  ]);
  return md5(pyJsonStringify(data));
}

export function exportState(w: Work): ExportState {
  if (!w.expSig) return "new";
  return w.expSig === workSignature(w) ? "done" : "changed";
}
