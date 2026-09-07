export const PREFS_STORAGE_KEY = "prayerbook-prefs";
export const INSTALL_DISMISS_KEY = "prayerbook-install-dismissed-until";

export type CachedPreferences = {
  theme: "day" | "night";
  fontSize: "small" | "default" | "large" | "xlarge";
  lineHeight: "compact" | "comfortable" | "spacious";
  autoScrollSpeed: "slow" | "normal" | "fast";
  autoScrollEnabled: boolean;
};

export const defaultPreferences: CachedPreferences = {
  theme: "day",
  fontSize: "default",
  lineHeight: "comfortable",
  autoScrollSpeed: "normal",
  autoScrollEnabled: false,
};

export const DAY_STATUS_BAR = "#3f5c4b";
export const NIGHT_STATUS_BAR = "#121416";

export function themeColorFor(theme: CachedPreferences["theme"]): string {
  return theme === "night" ? NIGHT_STATUS_BAR : DAY_STATUS_BAR;
}

function parseAutoScrollSpeed(value: unknown): CachedPreferences["autoScrollSpeed"] {
  if (value === "slow" || value === "fast") return value;
  return "normal";
}

export function parseAutoScrollEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

export function readCachedPreferences(): CachedPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed = JSON.parse(raw) as Partial<CachedPreferences> & {
      auto_scroll_speed?: string;
      auto_scroll_enabled?: boolean;
    };
    return {
      theme: parsed.theme === "night" ? "night" : "day",
      fontSize: ["small", "default", "large", "xlarge"].includes(parsed.fontSize ?? "")
        ? (parsed.fontSize as CachedPreferences["fontSize"])
        : "default",
      lineHeight: ["compact", "comfortable", "spacious"].includes(parsed.lineHeight ?? "")
        ? (parsed.lineHeight as CachedPreferences["lineHeight"])
        : "comfortable",
      autoScrollSpeed: parseAutoScrollSpeed(parsed.autoScrollSpeed ?? parsed.auto_scroll_speed),
      autoScrollEnabled: parseAutoScrollEnabled(parsed.autoScrollEnabled ?? parsed.auto_scroll_enabled),
    };
  } catch {
    return defaultPreferences;
  }
}

export function writeCachedPreferences(prefs: CachedPreferences) {
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  applyPreferences(prefs);
}

export function applyThemeColor(theme: CachedPreferences["theme"]) {
  if (typeof document === "undefined") return;
  const color = themeColorFor(theme);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
  document.documentElement.style.backgroundColor = color;
  document.documentElement.style.setProperty("--status-bar", color);
  let apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!apple) {
    apple = document.createElement("meta");
    apple.setAttribute("name", "apple-mobile-web-app-status-bar-style");
    document.head.appendChild(apple);
  }
  apple.setAttribute("content", "black-translucent");
  if (typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 1024) {
    document.documentElement.style.setProperty("--safe-top", "max(env(safe-area-inset-top, 0px), 48px)");
  }
}

export function applyPreferences(prefs: CachedPreferences) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.fontSize = prefs.fontSize;
  root.dataset.lineHeight = prefs.lineHeight;
  applyThemeColor(prefs.theme);
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
    const color = theme === "night" ? ${JSON.stringify(NIGHT_STATUS_BAR)} : ${JSON.stringify(DAY_STATUS_BAR)};
    root.style.backgroundColor = color;
    root.style.setProperty("--status-bar", color);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
    let apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!apple) {
      apple = document.createElement("meta");
      apple.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      document.head.appendChild(apple);
    }
    apple.setAttribute("content", "black-translucent");
    if (Math.min(window.innerWidth, window.innerHeight) < 1024) {
      root.style.setProperty("--safe-top", "max(env(safe-area-inset-top, 0px), 48px)");
    }
  } catch (e) {}
})();`;
