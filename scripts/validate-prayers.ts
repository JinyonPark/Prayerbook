import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownDocument, toPrayerItem } from "../lib/prayers/markdown";
import { validatePrayerItems } from "../lib/prayers/validate";

async function main() {
  const dir = path.join(process.cwd(), "content", "prayers");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  const items = [];

  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    const parsed = parseMarkdownDocument(raw);
    items.push(toPrayerItem(parsed.data, parsed.content));
  }

  const issues = validatePrayerItems(items);
  for (const issue of issues) {
    console[issue.level === "error" ? "error" : "warn"](issue.message);
  }

  if (issues.some((issue) => issue.level === "error")) {
    process.exit(1);
  }

  console.log(`validated ${items.length} prayers`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
