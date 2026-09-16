/* My タイマー Service Worker
   - PWA としてのインストール／オフライン対応
   - Windows 11 ウィジェットボード（PWA Widgets）のイベント処理
*/

const CACHE_VERSION = 'apptimer-v3';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './widget/timer-card.json',
    './widget/timer-data.json'
];

// ---------- インストール / 有効化 ----------
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // 1ファイルの失敗で全体を落とさないよう個別に追加する
        await Promise.all(APP_SHELL.map(async (url) => {
            try {
                await cache.add(new Request(url, { cache: 'reload' }));
            } catch (e) {
                console.warn('[sw] precache skip:', url, e);
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))));
        await self.clients.claim();
    })());
});

// ---------- フェッチ戦略 ----------
// HTML: ネットワーク優先（更新をすぐ反映）／それ以外: キャッシュ優先＋裏で更新
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (!isSameOrigin && !isFont) return;

    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(req);
                const cache = await caches.open(CACHE_VERSION);
                cache.put('./index.html', fresh.clone());
                return fresh;
            } catch (e) {
                return (await caches.match('./index.html')) ||
                       (await caches.match('./')) ||
                       Response.error();
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
        }).catch(() => null);
        return cached || (await network) || Response.error();
    })());
});

// ---------- Windows ウィジェット ----------
// アプリの絶対URLを実行時に解決するので、GitHub Pages 以外へ配置しても正しく動く
function widgetPayloadData() {
    const appUrl = new URL('./', self.registration.scope).href;
    return {
        title: 'My タイマー',
        subtitle: 'ワンタップでカウントダウン開始',
        appUrl: appUrl,
        iconUrl: new URL('icons/icon-192.png', appUrl).href
    };
}

async function renderWidget(widget) {
    if (!widget || !widget.definition) return;
    let template;
    try {
        const res = await fetch(widget.definition.msAcTemplateUrl);
        template = await res.text();
    } catch (e) {
        console.warn('[sw] widget template fetch failed:', e);
        return;
    }
    const payload = {
        template: template,
        data: JSON.stringify(widgetPayloadData())
    };
    try {
        await self.widgets.updateByTag(widget.definition.tag, payload);
    } catch (e) {
        console.warn('[sw] widget update failed:', e);
    }
}

// ウィジェットがボードに追加された / 再開した / 更新要求が来た
self.addEventListener('widgetinstall', (event) => {
    event.waitUntil(renderWidget(event.widget));
});
self.addEventListener('widgetresume', (event) => {
    event.waitUntil(renderWidget(event.widget));
});

// ウィジェット上のアクション（Action.Execute を使う場合のフォールバック）
self.addEventListener('widgetclick', (event) => {
    const appUrl = new URL('./', self.registration.scope).href;
    switch (event.action) {
        case 'start-timer': {
            const minutes = (event.data && event.data.minutes) || 1;
            event.waitUntil(self.clients.openWindow(`${appUrl}?m=${minutes}&autostart=1`));
            break;
        }
        case 'open-app':
            event.waitUntil(self.clients.openWindow(appUrl));
            break;
        default:
            event.waitUntil(renderWidget(event.widget));
    }
});

// 起動直後に既存ウィジェットを描画し直す
self.addEventListener('activate', (event) => {
    if (!('widgets' in self)) return;
    event.waitUntil((async () => {
        try {
            const widgets = await self.widgets.matchAll({ installable: true });
            await Promise.all(widgets.map(renderWidget));
        } catch (e) {
            console.warn('[sw] widget refresh failed:', e);
        }
    })());
});
