import fs from "node:fs";
import path from "node:path";

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
const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/apply-remote-sql.mjs <sql-file>...");
  process.exit(1);
}

async function sql(query, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAIL ${label} HTTP ${res.status}: ${text.slice(0, 4000)}`);
    throw new Error(label);
  }
  console.log(`OK ${label} (${query.length} chars)`);
  if (/^\s*select/i.test(query)) {
    console.log(text.slice(0, 8000));
  }
}

for (const file of files) {
  const query = fs.readFileSync(path.resolve(ROOT, file), "utf8");
  await sql(query, file);
}

await sql("notify pgrst, 'reload schema';", "reload schema");
