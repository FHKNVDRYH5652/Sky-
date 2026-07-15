// ZIP File Host - Virtual Web Server Service Worker
// Intercepts requests to /hosted/:siteId/... and serves them from in-memory or IndexedDB zip files

const sites = {}; // Cache: siteId -> { filepath: { content: ArrayBuffer, mimeType: string } }
const clientToSite = {}; // Map: clientId -> siteId for extremely robust subresource routing
const DB_NAME = 'ziphost_db';
const STORE_NAME = 'sites';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Communication from main thread
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'REGISTER_SITE') {
    const { siteId, files } = data;
    sites[siteId] = files;
    
    // Send a confirmation back
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, siteId });
    }
  } else if (data && data.type === 'UNREGISTER_SITE') {
    const { siteId } = data;
    delete sites[siteId];
  }
});

// Helper to normalize file paths for lookup
function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

// Retrieve site files map directly from IndexedDB
function getSiteFromIndexedDB(siteId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(siteId);
      
      getReq.onsuccess = () => {
        const result = getReq.result;
        if (result && result.files) {
          resolve(result.files);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Handle intercept and response logic
async function handleFetch(event) {
  const url = new URL(event.request.url);
  
  // Intercept requests targeting /hosted/<siteId>/...
  // Matches both with trailing slash, no trailing slash, or nested files
  let match = url.pathname.match(/^\/hosted\/([^\/]+)(?:\/(.*))?$/);
  let siteId = '';
  let filePath = '';
  
  if (match) {
    siteId = match[1];
    filePath = match[2] || '';
    if (event.clientId) {
      clientToSite[event.clientId] = siteId;
    }
  } else {
    // 1. Client ID check: if this client made a request earlier, it belongs to the same site
    if (event.clientId && clientToSite[event.clientId]) {
      siteId = clientToSite[event.clientId];
      filePath = url.pathname;
    } else {
      // 2. Referrer Fallback: check if the request was made by a page inside /hosted/<siteId>/
      const referrer = event.request.referrer;
      if (referrer) {
        try {
          const refUrl = new URL(referrer);
          const refMatch = refUrl.pathname.match(/^\/hosted\/([^\/]+)(?:\/(.*))?$/);
          if (refMatch) {
            siteId = refMatch[1];
            // Use absolute path of the request for lookup (relative to root of the hosted site)
            filePath = url.pathname;
            if (event.clientId) {
              clientToSite[event.clientId] = siteId;
            }
          }
        } catch (e) {
          // Ignore malformed referrer URLs
        }
      }
    }
  }
  
  // If we couldn't resolve a siteId, let it fetch from real network/server
  if (!siteId) {
    return fetch(event.request);
  }
  
  // Decode URI component (handles spaces and encoded characters in filenames)
  try {
    filePath = decodeURIComponent(filePath);
  } catch (e) {
    // Fallback
  }
  
  // If path is empty or ends with a slash, default to index.html
  if (!filePath || filePath.endsWith('/')) {
    filePath = filePath + 'index.html';
  }
  
  let site = sites[siteId];
  if (!site) {
    // Attempt lazy loading from IndexedDB to ensure persistence across reloads/new tabs
    try {
      const dbSiteFiles = await getSiteFromIndexedDB(siteId);
      if (dbSiteFiles) {
        sites[siteId] = dbSiteFiles; // Cache in-memory
        site = dbSiteFiles;
      }
    } catch (e) {
      console.error('[SW] Failed to load site from IndexedDB fallback:', e);
    }
  }
  
  if (site) {
    let normalizedRequestPath = normalizePath(filePath);
    let file = site[normalizedRequestPath];
    
    // Fallback lookups
    if (!file) {
      const keys = Object.keys(site);
      const lowerPath = normalizedRequestPath.toLowerCase();
      
      // 1. Case-insensitive search
      let matchedKey = keys.find(k => normalizePath(k).toLowerCase() === lowerPath);
      
      // 2. Ending-with search (handles subfolder matching and common prefix stripping)
      if (!matchedKey) {
        matchedKey = keys.find(k => {
          const normalizedKey = normalizePath(k);
          return normalizedKey.endsWith(normalizedRequestPath) || lowerPath.endsWith(normalizedKey.toLowerCase());
        });
      }
      
      if (matchedKey) {
        file = site[matchedKey];
      }
    }
    
    if (file) {
      // Correct mimeType, headers and CORS rules
      const responseHeaders = {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'X-Frame-Options': 'ALLOWALL',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      };
      
      return new Response(file.content, {
        status: 200,
        statusText: 'OK',
        headers: responseHeaders
      });
    }
  }
  
  // 404 response page
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - File Not Found | ZipHost Sandbox</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
      <style>
        body { font-family: 'Inter', sans-serif; }
        code { font-family: 'JetBrains Mono', monospace; }
      </style>
    </head>
    <body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6 selection:bg-rose-500/30 selection:text-white">
      <div class="max-w-md w-full bg-slate-900/60 border border-slate-800/80 p-8 rounded-2xl text-center shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div class="w-16 h-16 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">
          ⚠️
        </div>
        
        <h1 class="text-2xl font-bold tracking-tight text-white mb-2">404: Virtual File Not Found</h1>
        <p class="text-slate-400 text-sm mb-6 leading-relaxed">
          The simulated browser requested a file that is not available in the current project build tree.
        </p>
        
        <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 mb-6 text-left">
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Requested Path</div>
          <code class="text-xs text-rose-400 break-all">/${filePath}</code>
        </div>
        
        <div class="text-xs text-slate-500 leading-relaxed">
          💡 <strong>Tip:</strong> Try uploading the ZIP again or make sure the file is named correctly and placed in the right directory folder.
        </div>
      </div>
    </body>
    </html>
  `, {
    status: 404,
    headers: { 'Content-Type': 'text/html' }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. NEVER intercept requests to external domains (CDNs, Google Fonts, APIs, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. NEVER intercept internal platform, Vite dev paths, or backend API routes
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/@') || 
    url.pathname.startsWith('/src/') || 
    url.pathname.startsWith('/node_modules/') || 
    url.pathname === '/sw.js' ||
    url.pathname === '/favicon.ico'
  ) {
    return;
  }
  
  const isHostedPath = url.pathname.startsWith('/hosted/');
  const isHostedReferrer = event.request.referrer && event.request.referrer.includes('/hosted/');
  
  if (isHostedPath || isHostedReferrer) {
    event.respondWith(handleFetch(event));
  }
});
