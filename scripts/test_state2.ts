import { stateOf } from "../src/lib/mylist/logic";
import type { Work } from "../src/lib/mylist/types";
const w = {
  id: "x", sid: "eng-series-1002", title: "عمل من البرنامج القديم", type: "series", category: "مسلسل",
  hub: "eng", year: "2023", overview: "وصف تجريبي", poster: "", posterLocal: "", backdrop: "",
  rating: "", studio: "", genres: "", classification: "", altTitle: "",
  expSig: "01d56a773247e872d4bdaa414f88fed0", added: "2026-10-26T14:49:20", metaLocked: [], done: false,
  seasons: [{ number: 1, sourceUrl: "", episodes: [
    { number: 1, title: "", link: "https://ok.ru/video/777", servers: [{ name: "", url: "https://ok.ru/video/777", enabled: true }] },
    { number: 2, title: "", link: "https://youtu.be/dQw4w9WgXcQ", servers: [{ name: "", url: "https://youtu.be/dQw4w9WgXcQ", enabled: true }] },
  ]}],
} as unknown as Work;
console.log("state with API-shaped work:", stateOf(w)); // المفروض done
