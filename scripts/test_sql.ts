import { buildSql } from "../src/lib/mylist/sqlbuilder";
import type { Work } from "../src/lib/mylist/types";

const w = {
  id: "t1", sid: "", title: "اختبار", type: "series", category: "مسلسل", hub: "eng",
  year: "2024", overview: "", poster: "", posterLocal: "", backdrop: "", rating: "",
  studio: "", genres: "", classification: "", altTitle: "", expSig: "", added: "",
  metaLocked: [], done: false,
  seasons: [{ number: 1, sourceUrl: "", episodes: [{ number: 1, title: "", link: "https://ok.ru/video/123", servers: [{ name: "VIP", url: "https://ok.ru/video/123", enabled: true }] }] }],
} as unknown as Work;

const { sql } = buildSql([w], ["t1"], { dialect: "mssql", dbName: "vibehub", schema: "dbo" });
console.log(sql.split("\n").filter(l => l.includes("DELETE") || l.includes("media") || l.includes("hub")).join("\n"));
