const CACHE="roteador-vtk-v2";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest"];
self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("roteador-vtk-")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:"no-store"});
      if(response.ok){
        const cache=await caches.open(CACHE);
        cache.put(event.request,response.clone());
      }
      return response;
    }catch(error){
      const cached=await caches.match(event.request);
      if(cached) return cached;
      throw error;
    }
  })());
});
