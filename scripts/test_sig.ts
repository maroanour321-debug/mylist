import { workSignature } from "../src/lib/mylist/signature";
import { normalizeWork } from "../src/lib/mylist/logic";
import type { Work } from "../src/lib/mylist/types";

const w = normalizeWork({
  title: "مسلسل تجريبي", type: "series", category: "مسلسل", year: "2024",
  seasons: [{ number: 1, episodes: [
    { number: 1, title: "", servers: [{ name: "VIP", url: "https://ok.ru/video/123456" }] },
    { number: 2, title: "حلقة خاصة", servers: [] },
  ]}],
});
console.log("TS_SIG=" + workSignature(w as Work));
