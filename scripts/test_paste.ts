import { fillSmart } from "../src/lib/mylist/text";
import { normalizeWork, newWork } from "../src/lib/mylist/logic";
import { episodeServers } from "../src/lib/mylist/urls";
import type { Work } from "../src/lib/mylist/types";

const w = newWork({ title: "ت", seasons: [{ number: 1, episodes: Array.from({length: 10}, (_, i) => ({ number: i+1, title: "", link: "", servers: [] })) }] });
const season = w.seasons[0];
const text = `حلقة 1
https://ok.ru/video/111
https://youtu.be/abc12345678

حلقة ٣
https://www.youtube.com/watch?v=dQw4w9WgXcQ

https://drive.google.com/file/d/1AbC_xyz123/view
https://dood.to/d/abc123def
https://ok.ru/video/222`;
const { filled, numbered } = fillSmart(season, text);
console.log("filled:", filled, "numbered:", numbered);
for (const ep of season.episodes.slice(0, 5)) {
  console.log(`ep${ep.number}:`, JSON.stringify(episodeServers(ep).map(s => s.url)));
}
console.log("total eps now:", season.episodes.length);
