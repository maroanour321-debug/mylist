// أنواع البيانات المشتركة بين الواجهة والسيرفر — نفس نموذج برنامج "قائمتي"
export interface ServerT {
  name: string;
  url: string;
  enabled?: boolean; // false = مقفول (مش هيتصدّر)
}

export interface EpisodeT {
  number: number;
  title: string;
  servers: ServerT[]; // الأصل؛ link متزامن تلقائياً
  link?: string; // لينكات مفصولة بمسافة (توافق قديم)
}

export interface SeasonT {
  number: number;
  sourceUrl?: string;
  episodes: EpisodeT[];
}

export interface Work {
  id: string;
  sid: string;
  title: string;
  type: "movie" | "series";
  category: string; // فيلم / مسلسل / أنمي / كرتون
  hub: string; // arabic | eng | anime | cartoon
  year: string;
  overview: string;
  poster: string;
  posterLocal: string;
  backdrop: string;
  rating: string;
  studio: string;
  genres: string;
  classification: string;
  altTitle: string;
  expSig: string;
  added: string;
  metaLocked: string[];
  done: boolean;
  seasons: SeasonT[];
}

export interface MySettings {
  tmdb_key: string;
  dialect: "mssql" | "mysql";
  db_name: string;
  schema: string;
  image_url_prefix: string;
  auto_metadata: boolean;
}

export interface SearchResult {
  source: string;
  ext_id: string | number;
  type: "movie" | "series";
  title: string;
  year: string;
  overview: string;
  poster: string;
  category: string;
  alt_title?: string;
  backdrop?: string;
  genres?: string;
  rating?: string;
  studio?: string;
  classification?: string;
  lang?: string;
  en?: string;
}

export interface ImageResult {
  url: string;
  thumb: string;
  title: string;
  source: string;
  w: number;
  h: number;
}

export interface ScrapeResult {
  episode_number: number;
  title: string;
  servers: string[];
}

export interface MetadataResult {
  found: boolean;
  source: string;
  matched: string;
  fields: Record<string, string>;
  seasons?: SeasonT[];
  error?: string;
}

export type ExportState = "new" | "changed" | "done";

export const HUBS = ["arabic", "eng", "anime", "cartoon"] as const;
export const CATEGORIES = ["مسلسل", "فيلم", "أنمي", "كرتون"] as const;
export const SERIES_CATS = ["مسلسل", "أنمي", "كرتون"] as const;
export const META_FIELDS = ["title", "alt_title", "year", "overview", "poster", "backdrop", "genres", "rating", "studio", "classification"] as const;
export type MetaField = (typeof META_FIELDS)[number];
export const META_LABELS: Record<MetaField, string> = {
  title: "الاسم",
  alt_title: "الاسم الأصلي",
  year: "السنة",
  overview: "الوصف",
  poster: "صورة العمل",
  backdrop: "صورة الخلفية",
  genres: "الأنواع",
  rating: "التقييم",
  studio: "الاستوديو / القناة",
  classification: "التصنيف العمري",
};

export const CAT_COLOR: Record<string, string> = {
  مسلسل: "#0d9488",
  فيلم: "#0891b2",
  أنمي: "#db2777",
  كرتون: "#d97706",
};

export const DEFAULT_SETTINGS: MySettings = {
  tmdb_key: "",
  dialect: "mssql",
  db_name: "",
  schema: "dbo",
  image_url_prefix: "",
  auto_metadata: true,
};
