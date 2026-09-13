const CACHE='team71-v26-roster';
const STATIC=['./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);

  // Live game/history/sync data must NEVER come from Cache Storage.
  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(req,{cache:'no-store'}));
    return;
  }

  // Always try the network first for page navigations so a deployment
  // becomes visible on the first reload. Use cached shell only when offline.
  if(req.mode==='navigate' || url.pathname==='/' || url.pathname.endsWith('/index.html')){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(resp=>{
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{});
          return resp;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Static icons/manifest may be cached.
  event.respondWith(
    caches.match(req).then(hit=>{
      if(hit) return hit;
      return fetch(req).then(resp=>{
        if(req.method==='GET' && resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        }
        return resp;
      });
    })
  );
});