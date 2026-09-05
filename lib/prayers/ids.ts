import { createHash } from "node:crypto";

const UUID_NAMESPACE = "prayer-book:prayer-item:";

export function uuidFromSlug(slug: string): string {
  const hash = createHash("sha1").update(`${UUID_NAMESPACE}${slug}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}
