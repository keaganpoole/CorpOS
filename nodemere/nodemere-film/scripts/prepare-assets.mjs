import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("..");
const env = Object.fromEntries(
  (await fs.readFile(path.join(root, ".env"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i),
        l
          .slice(i + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);
const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const fields =
  "id,full_name,first_name,description,stereotype,avatar,avatar_video,traits,voice,age,is_active,banner_id,personality_id,personality_type,personality:personalities(mbti,personality)";
const response = await fetch(
  `${env.VITE_SUPABASE_URL}/rest/v1/receptionist_catalog?${new URLSearchParams({ select: fields, order: "full_name.asc" })}`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!response.ok) throw new Error(`Public catalog: ${response.status}`);
const allRows = await response.json();
console.log(
  "Catalog response",
  new URL(env.VITE_SUPABASE_URL).hostname,
  allRows.length,
  allRows
    .slice(0, 3)
    .map((p) => ({
      name: p.full_name,
      active: p.is_active,
      avatar: Boolean(p.avatar),
    })),
);
const rows = allRows.filter((p) => p.avatar);
await fs.mkdir("public/catalog", { recursive: true });
await fs.mkdir("src/product", { recursive: true });
async function asset(url, name) {
  const dest = `public/catalog/${name}`;
  try {
    await fs.access(dest);
  } catch {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
  }
  return `catalog/${name}`;
}
for (const row of rows) {
  if (!row.personality && row.personality_id) {
    const r = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/personalities?${new URLSearchParams({ id: `eq.${row.personality_id}`, select: "mbti,personality" })}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (r.ok) row.personality = (await r.json())[0] || null;
  }
  row.voice = row.voice ? "silent-demo-presence" : null;
  row.avatar = await asset(
    row.avatar,
    `${row.id}${path.extname(new URL(row.avatar).pathname) || ".png"}`,
  );
  if (row.avatar_video) {
    const url = /^https?:/.test(row.avatar_video)
      ? row.avatar_video
      : `${env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/videos/${row.avatar_video.split("/").map(encodeURIComponent).join("/")}`;
    row.avatar_video_source = url;
    // Only the selected portrait needs video in this opening.
    if (/kayla/i.test(row.full_name))
      row.avatar_video = await asset(url, `${row.id}-portrait.mp4`);
    else row.avatar_video = null;
  }
}
const selected = rows.find((p) => /kayla/i.test(p.full_name));
console.log("Selected banner id", selected.banner_id);
const bannerSource = /^https?:/.test(selected.banner_id)
  ? selected.banner_id
  : `${env.VITE_SUPABASE_URL}/storage/v1/object/public/banners/${selected.banner_id}.png`;
const banner = await asset(bannerSource, "kayla-banner.png");
await fs.writeFile(
  "src/product/catalog.json",
  JSON.stringify({ rows, banner }, null, 2),
);
for (const [source, dest] of [
  ["src/sonar/nest/nest.css", "nest.css"],
  ["src/sonar/studio/studio.css", "studio.css"],
  ["src/sonar/studio/receptionistGallery.css", "gallery.css"],
  ["src/sonar/studio/catalogGeometry.js", "catalogGeometry.js"],
])
  await fs.copyFile(path.join(root, source), `src/product/${dest}`);
const brand = await fs.readFile(path.join(root, "src/index.css"), "utf8");
const tokens = brand.match(/:root\s*\{[\s\S]*?\}/)[0];
await fs.writeFile("src/product/brand.css", tokens);
console.log(
  JSON.stringify(
    {
      count: rows.length,
      selected: rows.find((p) => /kayla/i.test(p.full_name)),
      banner,
    },
    null,
    2,
  ),
);
