import fs from "node:fs/promises";
const catalog = JSON.parse(await fs.readFile("src/catalog.json", "utf8"));
for (const id of [4, 8, 12, 9, 10]) {
  const person = catalog.rows.find((p) => p.id === id);
  const dest = `public/videos/${id}-source.mp4`;
  try {
    await fs.access(dest);
    continue;
  } catch {}
  const response = await fetch(person.avatar_video_source);
  if (!response.ok) throw new Error(`${id}: ${response.status}`);
  await fs.writeFile(dest, new Uint8Array(await response.arrayBuffer()));
  console.log(`${person.full_name}: saved authentic catalog video`);
}
