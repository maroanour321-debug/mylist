// تصدير SQL لقاعدة vibehub (media / episodes / servers) — نفس build_sql في core.py
// الافتراضي SQL Server (T-SQL) وفيه اختيار MySQL
import type { Work, EpisodeT, ServerT } from "./types";
import { episodeServers, normalizeUrl } from "./urls";
import { displayPoster } from "./logic";

export const MEDIA_COLUMNS = ["id", "hub", "type", "title", "alt_title", "poster", "backdrop", "release_year", "rating", "studio", "genres", "classification"] as const;
export const EPISODE_COLUMNS = ["id", "media_id", "title", "image", "sort_order"] as const;
export const SERVER_COLUMNS = ["media_id", "episode_id", "name", "embed_url", "sort_order"] as const;
const CHUNK = 500; // SQL Server بيسمح بحد أقصى 1000 صف في INSERT واحد

const AR_ORD = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

export function seasonName(n: number): string {
  return "الموسم " + (n >= 1 && n < AR_ORD.length ? AR_ORD[n] : String(n));
}

export class Sql {
  dialect: string;
  mssql: boolean;
  schema: string;
  constructor(dialect = "mssql", schema = "dbo") {
    this.dialect = dialect === "mysql" ? "mysql" : "mssql";
    this.mssql = this.dialect === "mssql";
    this.schema = (schema || "").replace(/\W/g, "") || "dbo";
  }
  s(v: unknown): string {
    const t = String(v ?? "").replace(/\x00/g, "");
    if (this.mssql) return "N'" + t.replace(/'/g, "''") + "'"; // N'' عشان العربي
    return "'" + t.replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
  }
  sn(v: unknown): string {
    const t = String(v ?? "").trim();
    return t ? this.s(t) : "NULL";
  }
  col(c: string): string {
    return this.mssql ? `[${c}]` : `\`${c}\``;
  }
  tbl(t: string): string {
    return this.mssql ? `[${this.schema}].[${t}]` : `\`${t}\``;
  }
}

export function qnum(v: unknown, integer = false): string {
  const f = parseFloat(String(v ?? "").trim());
  if (Number.isNaN(f)) return "NULL";
  return integer ? String(Math.trunc(f)) : String(f);
}

export function cleanGenres(g: string): string {
  const parts = (g || "").split(/[,،/]/).map((p) => p.trim()).filter(Boolean);
  return [...new Set(parts)].join(",");
}

export function assignSids(allWorks: Work[], start = 1001): void {
  // ID ثابت بنفس شكل القاعدة: anime-series-1001 / anime-movie-1002 ...
  const top: Record<string, number> = {};
  for (const w of allWorks) {
    const m = (w.sid || "").match(/^(.*)-(\d+)$/);
    if (m) top[m[1]] = Math.max(top[m[1]] || 0, parseInt(m[2], 10));
  }
  for (const w of allWorks) {
    if (w.sid) continue;
    const prefix = `${w.hub || "eng"}-${w.type}`;
    top[prefix] = Math.max(top[prefix] || 0, start - 1) + 1;
    w.sid = `${prefix}-${top[prefix]}`;
  }
}

export function episodeId(sid: string, seasonNo: number, epNo: number): string {
  if (seasonNo === 1) return `${sid}-ep-${epNo}`;
  return `${sid}-s${seasonNo}-ep-${epNo}`;
}

export function episodeTitle(seasonNo: number, ep: EpisodeT): string {
  const custom = (ep.title || "").trim();
  if (custom && /^(ال)?حلقة/.test(custom)) return custom; // مثال: "حلقة خاصة"
  return `الحلقة ${ep.number} - ${seasonName(seasonNo)}`;
}

function mediaValues(w: Work, sq: Sql, imagePrefix: string): string[] {
  return [
    sq.s(w.sid),
    sq.s(w.hub || "eng"),
    sq.s(w.type),
    sq.s(w.title),
    sq.sn(w.altTitle),
    sq.sn(displayPoster(w)),
    sq.sn(w.backdrop),
    qnum(w.year, true),
    qnum(w.rating),
    sq.sn(w.studio),
    sq.sn(cleanGenres(w.genres)),
    sq.sn(w.classification),
  ];
}

function insertChunks(sq: Sql, table: string, cols: readonly string[], rows: string[]): string[] {
  const head = `INSERT INTO ${sq.tbl(table)} (${cols.map((c) => sq.col(c)).join(",")}) VALUES\n`;
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    out.push(head + rows.slice(i, i + CHUNK).join(",\n") + ";");
  }
  return out;
}

export interface SqlStats {
  works: number;
  episodes: number;
  servers: number;
  skipped: string[];
  dialect: string;
  ids: string[];
}

export interface SqlOptions {
  dialect?: string;
  dbName?: string;
  schema?: string;
  imagePrefix?: string;
  start?: number;
  onlySelected?: string[]; // أعمال محددة (الجديد والمعدّل بس)
}

export interface SqlResult {
  sql: string;
  stats: SqlStats;
  sids: Record<string, string>; // workId -> sid (للحفظ بعد التصدير)
}

export function buildSql(allWorks: Work[], selectedIds: string[] | null, options: SqlOptions): SqlResult {
  const opts = options || {};
  const sq = new Sql(opts.dialect, opts.schema);
  const works = selectedIds ? allWorks.filter((w) => selectedIds.includes(w.id)) : allWorks;
  assignSids(allWorks, opts.start || 1001);
  const L: string[] = [`-- تم التصدير من موقع 'قائمتي ويب' بتاريخ ${new Date().toISOString().slice(0, 16).replace("T", " ")}`];
  if (sq.mssql) {
    L.push(
      "-- النوع: SQL Server (T-SQL). شغّله في SSMS أو Azure Data Studio أو sqlcmd.",
      "-- ممكن تستورده أكتر من مرة: بيحدّث نفس الأعمال من غير ما يكرر حاجة.",
      "-- كل عمل في Transaction لوحده: لو حصل خطأ في عمل بيتلغي هو بس."
    );
    const db = (opts.dbName || "").replace(/[^\w\-. ]/g, "").trim();
    if (db) L.push(`USE [${db}];`, "GO");
    L.push("SET NOCOUNT ON;", "SET XACT_ABORT ON;", "GO", "");
  } else {
    L.push("-- النوع: MySQL (phpMyAdmin ← قاعدة vibehub ← Import).", "-- ممكن تستورده أكتر من مرة: بيحدّث نفس الأعمال من غير ما يكرر حاجة.", "SET NAMES utf8mb4;", "");
  }
  const stats: SqlStats = { works: 0, episodes: 0, servers: 0, skipped: [], dialect: sq.dialect, ids: [] };
  const sids: Record<string, string> = {};
  const imagePrefix = opts.imagePrefix || "";
  for (const w of works) {
    const movie = w.type === "movie";
    const sid = w.sid;
    const epRows: string[] = [];
    const srvRows: string[] = [];
    const fallbackImg = (w.backdrop || displayPoster(w) || "").trim();
    if (movie) {
      let order = 0;
      for (const s of w.seasons) {
        for (const e of s.episodes) {
          for (const sv of episodeServers(e)) {
            srvRows.push(`(${sq.s(sid)},NULL,${sq.s(sv.name || serverNameOf(sv.url))},${sq.s(sv.url)},${order})`);
            order += 1;
          }
        }
      }
    } else {
      for (const s of w.seasons) {
        for (const e of [...s.episodes].sort((a, b) => a.number - b.number)) {
          const links = episodeServers(e);
          if (!links.length) continue;
          const eid = episodeId(sid, s.number, e.number);
          epRows.push(`(${sq.s(eid)},${sq.s(sid)},${sq.s(episodeTitle(s.number, e))},${sq.s(fallbackImg)},${(s.number - 1) * 1000 + e.number - 1})`);
          links.forEach((sv, k) => {
            srvRows.push(`(${sq.s(sid)},${sq.s(eid)},${sq.s(sv.name || serverNameOf(sv.url))},${sq.s(sv.url)},${k})`);
          });
        }
      }
    }
    if (!srvRows.length) {
      stats.skipped.push(w.title);
      continue;
    }
    const vals = mediaValues(w, sq, imagePrefix);
    L.push(`-- ${w.title.replace(/\n/g, " ").replace(/\r/g, " ")}  (${sid})`);
    L.push(sq.mssql ? "BEGIN TRANSACTION;" : "START TRANSACTION;");
    L.push(`DELETE FROM ${sq.tbl("servers")} WHERE ${sq.col("media_id")}=${sq.s(sid)} OR ${sq.col("episode_id")}=${sq.s(sid + "-%")};`);
    L.push(`DELETE FROM ${sq.tbl("episodes")} WHERE ${sq.col("media_id")}=${sq.s(sid)};`);
    if (sq.mssql) {
      const sets = MEDIA_COLUMNS.map((c, i) => (c === "id" ? "" : `${sq.col(c)}=${vals[i]}`)).filter(Boolean).join(", ");
      L.push(
        `IF EXISTS (SELECT 1 FROM ${sq.tbl("media")} WHERE ${sq.col("id")}=${sq.s(sid)})\n  UPDATE ${sq.tbl("media")} SET ${sets}\n  WHERE ${sq.col("id")}=${sq.s(sid)};\nELSE\n  INSERT INTO ${sq.tbl("media")} (${MEDIA_COLUMNS.map((c) => sq.col(c)).join(",")})\n  VALUES (${vals.join(",")});`
      );
    } else {
      const upd = MEDIA_COLUMNS.filter((c) => c !== "id").map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(",");
      L.push(`INSERT INTO \`media\` (${MEDIA_COLUMNS.map((c) => sq.col(c)).join(",")}) VALUES (${vals.join(",")})\n  ON DUPLICATE KEY UPDATE ${upd};`);
    }
    if (epRows.length) L.push(...insertChunks(sq, "episodes", EPISODE_COLUMNS, epRows));
    L.push(...insertChunks(sq, "servers", SERVER_COLUMNS, srvRows));
    L.push(sq.mssql ? "COMMIT TRANSACTION;" : "COMMIT;");
    if (sq.mssql) L.push("GO");
    L.push("");
    stats.works += 1;
    stats.ids.push(w.id);
    stats.episodes += epRows.length;
    stats.servers += srvRows.length;
    sids[w.id] = sid;
  }
  if (sq.mssql) {
    L.push(`PRINT N'Import finished: ${stats.works} works, ${stats.episodes} episodes, ${stats.servers} servers';`);
  }
  return { sql: L.join("\n"), stats, sids };
}

function serverNameOf(url: string): string {
  try {
    const u = url.includes("//") ? url : "//" + url;
    let host = new URL(normalizeUrl(u)).hostname.toLowerCase().split(":")[0];
    const parts = host.split(".").filter((p) => p && p !== "www");
    if (parts.length >= 2) return parts[parts.length - 2];
    return parts[0] || "server";
  } catch {
    return "server";
  }
}
