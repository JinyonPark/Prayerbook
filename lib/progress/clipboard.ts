export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError";
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to a layout-safe execCommand fallback
    }
  }
  if (typeof document === "undefined") return false;
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.style.position = "fixed";
  input.style.top = "0";
  input.style.left = "-9999px";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  input.style.border = "0";
  input.style.padding = "0";
  input.style.margin = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  input.remove();
  return ok;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export async function shareOrCopyText(payload: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareOutcome> {
  const fallbackText = `${payload.title}\n\n${payload.text}\n\n${payload.url}`;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
    }
  }
  const copied = await copyTextToClipboard(fallbackText);
  return copied ? "copied" : "failed";
}
