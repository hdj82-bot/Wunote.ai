// Wunote service worker — offline mode with dual cache strategy.

const STATIC_CACHE = 'wunote-static-v1'
const API_CACHE = 'wunote-api-v1'
const ALL_CACHES = [STATIC_CACHE, API_CACHE]

const PRECACHE_URLS = ['/', '/learn', '/vocabulary', '/progress', '/offline.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Network-first for API: fallback to API cache when offline.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(API_CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
        .catch(() => caches.match(request, { cacheName: API_CACHE }))
    )
    return
  }

  // Cache-first for static assets.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/images/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          })
      )
    )
    return
  }

  // Network-first for navigations; serve /offline.html if fully offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          return res
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match('/offline.html'))
        )
    )
    return
  }

  // Default: cache-first with network fallback.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
    )
  )
})

// Web Push handler — payload format: { title, body, url }
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Wunote', body: event.data.text() }
  }
  const { title = 'Wunote', body = '', url = '/' } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(target))
      if (existing) return existing.focus()
      return self.clients.openWindow(target)
    })
  )
})
