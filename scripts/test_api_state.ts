import { stateOf } from "../src/lib/mylist/logic";
import type { Work } from "../src/lib/mylist/types";

const res = await fetch("http://localhost:3000/api/works");
const { works } = (await res.json()) as { works: Work[] };
for (const w of works) {
  console.log(w.title, "=>", stateOf(w));
}
