export const PREFS_STORAGE_KEY = "prayerbook-prefs";
export const INSTALL_DISMISS_KEY = "prayerbook-install-dismissed-until";

export type CachedPreferences = {
  theme: "day" | "night";
  fontSize: "small" | "default" | "large" | "xlarge";
  lineHeight: "compact" | "comfortable" | "spacious";
};

export const defaultPreferences: CachedPreferences = {
  theme: "day",
  fontSize: "default",
  lineHeight: "comfortable",
};

export function readCachedPreferences(): CachedPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed = JSON.parse(raw) as Partial<CachedPreferences>;
    return {
      theme: parsed.theme === "night" ? "night" : "day",
      fontSize: ["small", "default", "large", "xlarge"].includes(parsed.fontSize ?? "")
        ? (parsed.fontSize as CachedPreferences["fontSize"])
        : "default",
      lineHeight: ["compact", "comfortable", "spacious"].includes(parsed.lineHeight ?? "")
        ? (parsed.lineHeight as CachedPreferences["lineHeight"])
        : "comfortable",
    };
  } catch {
    return defaultPreferences;
  }
}

export function writeCachedPreferences(prefs: CachedPreferences) {
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  applyPreferences(prefs);
}

export function applyPreferences(prefs: CachedPreferences) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.fontSize = prefs.fontSize;
  root.dataset.lineHeight = prefs.lineHeight;
}

export const THEME_INIT_SCRIPT = `(() => {
  try {
    const raw = localStorage.getItem(${JSON.stringify(PREFS_STORAGE_KEY)});
    const parsed = raw ? JSON.parse(raw) : {};
    const theme = parsed.theme === "night" ? "night" : "day";
    const fontSize = ["small", "default", "large", "xlarge"].includes(parsed.fontSize) ? parsed.fontSize : "default";
    const lineHeight = ["compact", "comfortable", "spacious"].includes(parsed.lineHeight) ? parsed.lineHeight : "comfortable";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.fontSize = fontSize;
    root.dataset.lineHeight = lineHeight;
  } catch (e) {}
})();`;
