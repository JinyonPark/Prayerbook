import { access } from "node:fs/promises";
import path from "node:path";

const FILES = [
  "icon-192.png",
  "icon-512.png",
  "icon-192-maskable.png",
  "icon-512-maskable.png",
  "apple-touch-icon.png",
];

async function main() {
  const dir = path.join(process.cwd(), "public", "icons");
  for (const name of FILES) {
    await access(path.join(dir, name));
  }
  await access(path.join(process.cwd(), "public", "favicon.ico"));
  console.log("Church-style icons are source files in public/icons. Skipping regeneration.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
