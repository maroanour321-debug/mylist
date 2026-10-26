// طبقة التخزين على السيرفر: قراءة/حفظ الأعمال (مواسم+حلقات+سيرفرات) + الإعدادات + الصور
import { db } from "@/lib/db";
import type { MySettings, Work, EpisodeT, SeasonT, ServerT } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { normalizeWork } from "../logic";
import { migrateEpisode } from "../urls";
import { uid } from "../logic";
import type { Prisma } from "@prisma/client";

export function dbWorkToWork(row: Prisma.WorkGetPayload<{ include: { seasons: { include: { episodes: { include: { servers: true } } } } } }>): Work {
  return normalizeWork({
    id: row.id,
    sid: row.sid,
    title: row.title,
    type: row.type,
    category: row.category,
    hub: row.hub,
    year: row.year,
    overview: row.overview,
    poster: row.poster,
    posterLocal: row.posterLocal,
    backdrop: row.backdrop,
    rating: row.rating,
    studio: row.studio,
    genres: row.genres,
    classification: row.classification,
    altTitle: row.altTitle,
    expSig: row.expSig,
    added: row.added,
    metaLocked: JSON.parse(row.metaLocked || "[]"),
    done: row.done,
    seasons: row.seasons
      .sort((a, b) => a.number - b.number)
      .map((s) => ({
        number: s.number,
        sourceUrl: s.sourceUrl,
        episodes: s.episodes
          .sort((a, b) => a.number - b.number)
          .map((e) => {
            const servers = e.servers.sort((a, b) => a.sort - b.sort).map((sv) => ({ name: sv.name, url: sv.url, enabled: sv.enabled }));
            // السيرفرات هي الأصل في القاعدة — بنبني link المتزامن منها (زي set_episode_servers)
            return { number: e.number, title: e.title, servers, link: servers.map((sv) => sv.url).join(" ") };
          }),
      })),
  });
}

export async function getWorks(): Promise<Work[]> {
  const rows = await db.work.findMany({
    include: { seasons: { include: { episodes: { include: { servers: true } } } } },
    orderBy: [{ sort: "asc" }, { added: "desc" }],
  });
  return rows.map(dbWorkToWork);
}

export async function getWork(id: string): Promise<Work | null> {
  const row = await db.work.findUnique({
    where: { id },
    include: { seasons: { include: { episodes: { include: { servers: true } } } } },
  });
  return row ? dbWorkToWork(row) : null;
}

async function syncSeasons(workId: string, seasons: SeasonT[]): Promise<void> {
  // استبدال كامل بسيط وموثوق: نمسح مواسم العمل ونكتب الحالة الحالية
  await db.season.deleteMany({ where: { workId } });
  for (const s of seasons) {
    const season = await db.season.create({
      data: { workId, number: s.number, sourceUrl: s.sourceUrl || "" },
    });
    for (const e of s.episodes) {
      migrateEpisode(e);
      const episode = await db.episode.create({
        data: { seasonId: season.id, number: e.number, title: e.title || "" },
      });
      const servers: ServerT[] = e.servers || [];
      let sort = 0;
      for (const sv of servers) {
        await db.server.create({
          data: { episodeId: episode.id, name: sv.name || "", url: sv.url || "", enabled: sv.enabled !== false, sort },
        });
        sort += 1;
      }
    }
  }
}

/** حفظ عمل كامل (create أو update) — الواجهة بتبعت العمل بالشكل الكامل */
export async function saveWork(input: Record<string, unknown>): Promise<Work> {
  const existing = input.id ? await db.work.findUnique({ where: { id: String(input.id) } }) : null;
  const normalized = normalizeWork(existing ? { ...input, id: existing.id } : input);
  const data = {
    sid: normalized.sid,
    title: normalized.title,
    type: normalized.type,
    category: normalized.category,
    hub: normalized.hub,
    year: normalized.year,
    overview: normalized.overview,
    poster: normalized.poster,
    posterLocal: normalized.posterLocal,
    backdrop: normalized.backdrop,
    rating: normalized.rating,
    studio: normalized.studio,
    genres: normalized.genres,
    classification: normalized.classification,
    altTitle: normalized.altTitle,
    expSig: normalized.expSig,
    added: normalized.added,
    metaLocked: JSON.stringify(normalized.metaLocked || []),
    done: normalized.done,
  };
  let workId: string;
  if (existing) {
    workId = existing.id;
    await db.work.update({ where: { id: workId }, data });
  } else {
    const count = await db.work.count();
    workId = normalized.id;
    await db.work.create({ data: { id: workId, ...data, sort: count } });
  }
  if (Array.isArray(input.seasons)) {
    await syncSeasons(workId, normalized.seasons);
  }
  return (await getWork(workId))!;
}

export async function deleteWork(id: string): Promise<void> {
  await db.work.delete({ where: { id } });
}

export async function patchWork(id: string, patch: Record<string, unknown>): Promise<Work | null> {
  const data: Record<string, unknown> = {};
  for (const k of ["sid", "title", "type", "category", "hub", "year", "overview", "poster", "posterLocal", "backdrop", "rating", "studio", "genres", "classification", "altTitle", "expSig", "added", "done"]) {
    if (k in patch) data[k] = patch[k];
  }
  if ("metaLocked" in patch) data.metaLocked = JSON.stringify(patch.metaLocked || []);
  if (Object.keys(data).length) {
    await db.work.update({ where: { id }, data }).catch(() => null);
  }
  if (Array.isArray(patch.seasons)) {
    const w = normalizeWork({ ...(await db.work.findUnique({ where: { id } })), seasons: patch.seasons });
    await syncSeasons(id, w.seasons);
  }
  return getWork(id);
}

export async function getMaxSort(): Promise<number> {
  const agg = await db.work.aggregate({ _max: { sort: true } });
  return agg._max.sort ?? -1;
}

// ---------------------------------------------------------------------------
// الإعدادات
// ---------------------------------------------------------------------------
export async function getSettings(): Promise<MySettings> {
  const rows = await db.setting.findMany();
  const stored: Record<string, string> = {};
  for (const r of rows) stored[r.key] = r.value;
  return {
    tmdb_key: stored.tmdb_key || DEFAULT_SETTINGS.tmdb_key,
    dialect: (stored.dialect as "mssql" | "mysql") || DEFAULT_SETTINGS.dialect,
    db_name: stored.db_name || DEFAULT_SETTINGS.db_name,
    schema: stored.schema || DEFAULT_SETTINGS.schema,
    image_url_prefix: stored.image_url_prefix || DEFAULT_SETTINGS.image_url_prefix,
    auto_metadata: stored.auto_metadata !== undefined ? stored.auto_metadata === "1" : DEFAULT_SETTINGS.auto_metadata,
  };
}

export async function saveSettings(s: Partial<MySettings>): Promise<MySettings> {
  const pairs: Array<[string, string]> = [];
  if (s.tmdb_key !== undefined) pairs.push(["tmdb_key", String(s.tmdb_key)]);
  if (s.dialect !== undefined) pairs.push(["dialect", s.dialect === "mysql" ? "mysql" : "mssql"]);
  if (s.db_name !== undefined) pairs.push(["db_name", String(s.db_name)]);
  if (s.schema !== undefined) pairs.push(["schema", String(s.schema)]);
  if (s.image_url_prefix !== undefined) pairs.push(["image_url_prefix", String(s.image_url_prefix)]);
  if (s.auto_metadata !== undefined) pairs.push(["auto_metadata", s.auto_metadata ? "1" : "0"]);
  for (const [key, value] of pairs) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  return getSettings();
}

// ---------------------------------------------------------------------------
// الصور المرفوعة
// ---------------------------------------------------------------------------
const IMG_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
const MAX_IMG_BYTES = 8 * 1024 * 1024; // 8MB للصورة المرفوعة

export async function saveImage(filename: string, mime: string, dataB64: string): Promise<{ id: string; url: string }> {
  const size = Math.floor((dataB64.length * 3) / 4);
  if (size > MAX_IMG_BYTES) throw new Error("الصورة كبيرة (> 8MB)");
  const cleanName = (filename || "image").replace(/[^\w.\-]/g, "_").slice(-80);
  const ext = (cleanName.split(".").pop() || "jpg").toLowerCase();
  const safeExt = IMG_EXTS.includes(ext) ? ext : "jpg";
  const safeMime = mime.startsWith("image/") ? mime : `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;
  const id = uid();
  await db.storedImage.create({ data: { id, filename: `${id}.${safeExt}`, mime: safeMime, data: dataB64, size } });
  return { id, url: `/api/images/${id}` };
}

export async function listImages(): Promise<Array<{ id: string; filename: string; url: string; size: number; createdAt: string }>> {
  const rows = await db.storedImage.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, filename: true, size: true, createdAt: true } });
  return rows.map((r) => ({ ...r, url: `/api/images/${r.id}`, createdAt: r.createdAt.toISOString() }));
}

export async function getImage(id: string): Promise<{ data: Buffer; mime: string } | null> {
  const row = await db.storedImage.findUnique({ where: { id } });
  if (!row) return null;
  return { data: Buffer.from(row.data, "base64"), mime: row.mime };
}

// ---------------------------------------------------------------------------
// نسخة احتياطية / استرجاع (نفس شكل my_list_data.json)
// ---------------------------------------------------------------------------
export async function exportBackup(): Promise<string> {
  const works = await getWorks();
  const settings = await getSettings();
  return JSON.stringify(
    {
      settings: { ...settings, tmdb_key: "" }, // المفتاح السري عمره مبيتحط في النسخة الاحتياطية
      works: works.map((w) => ({
        ...w,
        poster_local: w.posterLocal,
        alt_title: w.altTitle,
        exp_sig: w.expSig,
        meta_locked: w.metaLocked,
        seasons: w.seasons.map((s) => ({ number: s.number, source_url: s.sourceUrl, episodes: s.episodes })),
      })),
    },
    null,
    2
  );
}

export interface ImportStat {
  added: number;
  updated: number;
  skipped: number;
}

export async function importBackup(jsonText: string, mode: "replace" | "merge"): Promise<ImportStat> {
  const data = JSON.parse(jsonText) as { works?: Array<Record<string, unknown>> };
  const works = Array.isArray(data.works) ? data.works : [];
  const existing = await db.work.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((w) => w.id));
  const stat: ImportStat = { added: 0, updated: 0, skipped: 0 };
  if (mode === "replace") {
    await db.work.deleteMany({});
  }
  for (const raw of works) {
    const w = normalizeWork(raw);
    if (mode === "merge" && existingIds.has(w.id)) {
      stat.skipped += 1;
      continue;
    }
    if (existingIds.has(w.id)) stat.updated += 1;
    else stat.added += 1;
    await saveWork({ ...w } as unknown as Record<string, unknown>);
  }
  return stat;
}
