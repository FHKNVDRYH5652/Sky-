/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HostedSite, VirtualFile } from './types';

const DB_NAME = 'ziphost_db';
const DB_VERSION = 1;
const STORE_NAME = 'sites';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function saveSiteToDB(site: HostedSite): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Serialize VirtualFile for DB
    // We can store ArrayBuffer directly in IndexedDB, which is awesome!
    const serializedFiles: { [path: string]: any } = {};
    Object.entries(site.files).forEach(([path, file]) => {
      serializedFiles[path] = {
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        isBinary: file.isBinary,
        textValue: file.textValue,
        content: file.content // Raw ArrayBuffer is supported natively in IndexedDB!
      };
    });

    const serializedSite = {
      id: site.id,
      name: site.name,
      createdAt: site.createdAt,
      files: serializedFiles
    };

    const request = store.put(serializedSite);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteSiteFromDB(siteId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(siteId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function loadSitesFromDB(): Promise<HostedSite[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const sites: HostedSite[] = results.map((item: any) => {
          const files: { [path: string]: VirtualFile } = {};
          Object.entries(item.files).forEach(([path, rawFile]: [string, any]) => {
            files[path] = {
              path: rawFile.path,
              name: rawFile.name,
              mimeType: rawFile.mimeType,
              size: rawFile.size,
              isBinary: rawFile.isBinary,
              textValue: rawFile.textValue,
              content: rawFile.content as ArrayBuffer
            };
          });

          return {
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
            files
          };
        });

        // Sort sites by createdAt descending
        sites.sort((a, b) => b.createdAt - a.createdAt);
        resolve(sites);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to open database to load sites:', error);
    return [];
  }
}
