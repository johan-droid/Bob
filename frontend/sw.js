/* sw.js — Bob Service Worker */
const CACHE = 'bob-v1';
const OFFLINE_URLS = ['/', '/dashboard', '/offline.html'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS).catch(() => {})));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('/api/') || e.request.url.includes('socket.io')) return;
    e.respondWith(
        fetch(e.request)
            .then(r => {
                const clone = r.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
                return r;
            })
            .catch(() => caches.match(e.request).then(r => r || caches.match('/dashboard')))
    );
});

// Push notification handler
self.addEventListener('push', e => {
    const data = e.data?.json() ?? {};
    e.waitUntil(
        self.registration.showNotification(data.title || 'Bob — New Issue', {
            body:    data.body || 'A new PR health issue was detected.',
            icon:    '/icons/icon-192.png',
            badge:   '/icons/icon-192.png',
            data:    { url: data.url || '/dashboard' },
            actions: [{ action: 'open', title: 'View Dashboard' }],
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/dashboard';
    e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
        for (const c of list) {
            if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
        }
        return clients.openWindow(url);
    }));
});
