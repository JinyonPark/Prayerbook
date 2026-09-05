/** Keep original `1)` markers as visible text instead of markdown lists. */
export function preparePrayerMarkdown(markdown: string): string {
  return markdown
    .replace(/^(\d+(?:-\d+)?)\) /gm, "$1\\) ")
    .replace(/<([^>\n]{1,80})>/g, "&lt;$1&gt;");
}
