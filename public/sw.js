const SW_VERSION = "v1";
const STATIC_CACHE = `static-${SW_VERSION}`;
const OFFLINE_CACHE = `offline-${SW_VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) =>
        cache.add(new Request(OFFLINE_URL, { cache: "reload" })),
      )
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== OFFLINE_CACHE)
          .map((key) => caches.delete(key)),
      );

      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, event));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (isStaticAssetRequest(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request, event) {
  try {
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) return preloadResponse;
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

function isStaticAssetRequest(pathname) {
  if (pathname.startsWith("/_next/static/")) return true;

  return /\.(?:css|js|mjs|json|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf)$/i.test(
    pathname,
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone()).catch(() => undefined);
  }

  return response;
}
