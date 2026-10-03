/// <reference lib="webworker" />
// The app's service worker (built by vite-plugin-pwa, "injectManifest" mode).
// 1. Precaches the built app (HTML/JS/CSS/icons) so it opens instantly and
//    works as an installed app. API calls are NOT cached — data is always live.
// 2. Shows push notifications sent by the server and opens the right page
//    when one is tapped.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Any in-app page (not /api/...) is served from the cached index.html (the
// React app then shows the right screen).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

// The page asks us to take over after the user accepts "new version — reload".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

interface PushPayload {
  title: string
  body: string
  url?: string
}

self.addEventListener('push', (event) => {
  const data: PushPayload = event.data?.json() ?? { title: 'Shift Organizer', body: '' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url ?? '/' },
      lang: 'he',
      dir: 'auto',
    })
  )
})

// Tap on a notification: focus an open app window (and go to the page), or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string) ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows[0]
      if (existing) {
        await existing.focus()
        await existing.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })()
  )
})
