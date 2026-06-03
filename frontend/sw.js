/* sw.js — Bob Service Worker */
const CACHE = 'bob-v4';
const OFFLINE_URLS = ['/', '/offline.html'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => {
            // Use individual add for resilience against single 404s
            OFFLINE_URLS.forEach(url => {
                c.add(url).catch(() => console.log('SW: Could not cache', url));
            });
        })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    
    // Only intercept GET requests for our own origin
    if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

    // Let HTML navigations reach the network so deploys are visible immediately.
    if (e.request.mode === 'navigate' || e.request.destination === 'document') {
        return;
    }
    
    // Skip API, Socket.IO, and OAuth routes
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/socket.io/') ||
        url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/login/') ||
        url.pathname.startsWith('/callback/')) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then(res => {
                // If valid response, cache a clone and return
                if (res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
                }
                return res;
            })
            .catch(() => {
                // Network failure: Try cache, fallback to offline.html
                return caches.match(e.request).then(cached => {
                    return cached || caches.match('/offline.html');
                });
            })
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
