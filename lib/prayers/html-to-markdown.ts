const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": "\u00a0",
  "&bull;": "•",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function htmlToMarkdown(html: string): { heading: string; contentMd: string } {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withoutNav = withoutScripts.replace(/<div id="guide"[\s\S]*?<\/div>/gi, "");
  const headingMatch = withoutNav.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const heading = decodeEntities(stripTags(headingMatch?.[1] ?? "")).trim();

  const paragraphs = [...withoutNav.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
    paragraphToMarkdown(match[1]),
  );

  const contentMd = paragraphs.filter((paragraph) => paragraph.length > 0).join("\n\n");
  return { heading, contentMd };
}

function paragraphToMarkdown(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "{{BR}}");
  const decoded = decodeEntities(stripTags(withBreaks));
  return decoded
    .split("{{BR}}")
    .map((line) => collapseHtmlWhitespace(line).trim())
    .join("\n")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function decodeEntities(value: string): string {
  return value.replace(/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, (entity) => {
    if (ENTITY_MAP[entity]) return ENTITY_MAP[entity];
    const decimal = entity.match(/^&#(\d+);$/);
    if (decimal) return String.fromCharCode(Number(decimal[1]));
    const hex = entity.match(/^&#x([0-9a-fA-F]+);$/);
    if (hex) return String.fromCharCode(parseInt(hex[1], 16));
    return entity;
  });
}

function collapseHtmlWhitespace(value: string): string {
  return value.replace(/[ \t\r\n\f\v]+/g, " ");
}
