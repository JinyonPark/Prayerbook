const VERSION = "prayer-book-v26";
const SHELL = ["/", "/login", "/install", "/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isNextRouterRequest(request, url) {
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.has("RSC")) return true;
  if (request.headers.has("Next-Router-State-Tree")) return true;
  if (request.headers.has("Next-Url")) return true;
  if (request.headers.get("Purpose") === "prefetch") return true;
  if (request.headers.get("Sec-Purpose") === "prefetch") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return;
  if (isNextRouterRequest(request, url)) return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/rest/v1") || url.pathname.includes("/auth/v1/")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/prayers")) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname === "/sw.js") return;

  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
