// ZIP File Host - Virtual Web Server Service Worker
// Intercepts requests to /hosted/:siteId/... and serves them from in-memory zip files

const sites = {}; // siteId -> { filepath: { content: ArrayBuffer, mimeType: string } }

self.addEventListener('install', (event) => {
  // Activate immediately
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
  // Convert backslashes, remove double slashes, and remove leading/trailing slashes
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Intercept requests targeting /hosted/<siteId>/...
  const match = url.pathname.match(/^\/hosted\/([^\/]+)\/(.*)$/);
  if (match) {
    const siteId = match[1];
    let filePath = match[2];
    
    // Decode URI component (handles spaces and encoded characters in filenames)
    try {
      filePath = decodeURIComponent(filePath);
    } catch (e) {
      // Fallback to original
    }
    
    // If path is empty or ends with a slash, default to index.html
    if (!filePath || filePath.endsWith('/')) {
      filePath = filePath + 'index.html';
    }
    
    const site = sites[siteId];
    if (site) {
      let normalizedRequestPath = normalizePath(filePath);
      
      // Look for the file in our site mapping
      let file = site[normalizedRequestPath];
      
      // If not found, try to find by lowercase/exact matching or with subfolders
      if (!file) {
        const keys = Object.keys(site);
        
        // 1. Case-insensitive search
        const lowerPath = normalizedRequestPath.toLowerCase();
        let matchedKey = keys.find(k => normalizePath(k).toLowerCase() === lowerPath);
        
        // 2. Relative search if zip has a common root directory (e.g., "my-website-main/index.html")
        if (!matchedKey) {
          matchedKey = keys.find(k => {
            const normalizedKey = normalizePath(k);
            // Match files ending with our requested path, e.g., "folder/index.html" ends with "index.html"
            return normalizedKey.endsWith(normalizedRequestPath) || lowerPath.endsWith(normalizedKey.toLowerCase());
          });
        }
        
        if (matchedKey) {
          file = site[matchedKey];
        }
      }
      
      if (file) {
        // Return file contents with correct response headers
        const responseHeaders = {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'X-Frame-Options': 'ALLOWALL',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        };
        
        event.respondWith(
          new Response(file.content, {
            status: 200,
            statusText: 'OK',
            headers: responseHeaders
          })
        );
        return;
      }
    }
    
    // Return structured 404 message if file is missing in the virtual file system
    event.respondWith(
      new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; background: #0f172a; color: #f1f5f9; text-align: center; }
            h1 { color: #f43f5e; margin-bottom: 0.5rem; font-weight: 600; }
            p { color: #94a3b8; font-size: 1.1rem; }
            code { background: #1e293b; padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace; color: #38bdf8; }
            .hint { margin-top: 1.5rem; font-size: 0.9rem; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>404: File Not Found</h1>
          <p>Requested path: <code>/${filePath}</code></p>
          <p class="hint">Verify that this file exists in your uploaded ZIP structure.</p>
        </body>
        </html>
      `, {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      })
    );
  }
});
