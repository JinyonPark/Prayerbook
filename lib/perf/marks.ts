const PREFIX = "prayerbook:";

function enabled() {
  return process.env.NODE_ENV !== "production" && typeof performance !== "undefined";
}

export function perfMark(name: string) {
  if (!enabled()) return;
  performance.mark(`${PREFIX}${name}`);
}

export function perfMeasure(name: string, startMark: string, endMark: string) {
  if (!enabled()) return;
  try {
    performance.measure(`${PREFIX}${name}`, `${PREFIX}${startMark}`, `${PREFIX}${endMark}`);
  } catch {
    // start/end marks may be missing
  }
}

export function perfLog(group: string) {
  if (!enabled()) return;
  const rows = performance
    .getEntriesByType("measure")
    .filter((entry) => entry.name.startsWith(PREFIX) && entry.name.includes(group))
    .map((entry) => ({ name: entry.name.replace(PREFIX, ""), ms: Math.round(entry.duration) }));
  if (rows.length === 0) return;
  console.table(rows);
}
