// Service worker de Codex GH 2.4 — l'app funciona sense connexió.
// - Pàgina i scripts propis: xarxa primer (sempre l'última versió si hi ha connexió), cache com a recurs si no n'hi ha.
// - Icones/manifest i SDK de Firebase (gstatic): cache primer amb refresc en segon pla.
// - Mai s'intercepten les peticions a Firestore/Auth (googleapis.com): les gestiona Firebase.
const VERSION='codex-gh-v2.12.6';
const SHELL=['./','index.html','manifest.json','ui.js','merge.js','home.js','app.js','shift-profiles.js','sync.js','firebase-config.js','app-icon.png','icon-192.png','icon-512.png','icon-512-maskable.png','apple-touch-icon.png'];
const SDK=['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    await Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})));
    await Promise.all(SDK.map(u=>fetch(u,{mode:'no-cors'}).then(r=>c.put(u,r)).catch(()=>{})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;
  const isSdk=url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/');
  if(!sameOrigin&&!isSdk)return;
  if(isSdk||/\.(png|jpg|svg|ico|webmanifest)$/.test(url.pathname)||url.pathname.endsWith('manifest.json')){
    // cache primer + refresc en segon pla
    e.respondWith((async()=>{
      const c=await caches.open(VERSION),hit=await c.match(req,{ignoreSearch:true});
      const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(()=>null);
      return hit||(await net)||Response.error();
    })());
    return;
  }
  // HTML, JS, CSS propis: xarxa primer, cache si no hi ha connexió
  e.respondWith((async()=>{
    const c=await caches.open(VERSION);
    try{
      const r=await fetch(req,{cache:'no-cache'}); // revalida sempre amb el servidor (GitHub Pages cacheja 10 min)
      if(r&&r.ok)c.put(req,r.clone());
      return r;
    }catch(err){
      const hit=await c.match(req,{ignoreSearch:true})||(req.mode==='navigate'?await c.match('index.html'):null);
      return hit||Response.error();
    }
  })());
});
