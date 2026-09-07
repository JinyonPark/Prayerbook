import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) return [];
      return [[match[1], match[2].replace(/^"(.*)"$/, "$1")]];
    }),
);

const ref = process.env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD;
const files = process.argv.slice(2);
if (!ref || !password || files.length === 0) {
  console.error("Need SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD, and SQL files");
  process.exit(1);
}

const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;

for (const file of files) {
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--file", path.resolve(ROOT, file), "--db-url", dbUrl],
    { encoding: "utf8", shell: true, cwd: ROOT },
  );
  const redact = (text) =>
    (text || "")
      .replaceAll(password, "***")
      .replaceAll(encodeURIComponent(password), "***")
      .replaceAll(dbUrl, "***");
  if (result.stdout) process.stdout.write(redact(result.stdout));
  if (result.stderr) process.stderr.write(redact(result.stderr));
  if (result.status !== 0) {
    console.error(`FAIL ${file}`);
    process.exit(result.status ?? 1);
  }
  console.log(`OK ${file}`);
}
