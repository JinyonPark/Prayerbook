export function hardNavigate(href: string) {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}
