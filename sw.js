const C='pn-admin-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
e.respondWith(fetch(r).then(res=>{if(res.ok&&(r.mode==='navigate'||/\.(png|webmanifest)$/.test(u.pathname)))caches.open(C).then(c=>c.put(r,res.clone()));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('/?app=admin'))))});
