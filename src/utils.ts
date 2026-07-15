/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileTreeNode } from "./types";

// Get Content-Type based on extension
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'mjs':
      return 'application/javascript';
    case 'ts':
      return 'video/mp2t'; // or text/typescript if we want text edit
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'ico':
      return 'image/x-icon';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
    case 'md':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

// Detect if a file is likely binary
export function isBinaryFile(filename: string, mimeType: string): boolean {
  if (mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json' || mimeType === 'application/xml') {
    return false;
  }
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['html', 'css', 'js', 'json', 'xml', 'txt', 'md', 'svg'].includes(ext || '')) {
    return false;
  }
  return true;
}

// Format bytes to a human-readable string
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Build a structured FileTreeNode tree from an array of flat file paths
export function buildFileTree(paths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: "Root", path: "", isDirectory: true, children: [] };

  for (const path of paths) {
    if (!path || path.endsWith('/')) continue; // Skip directory entries
    
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children) {
        current.children = [];
      }

      let child = current.children.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: isLast ? undefined : []
        };
        current.children.push(child);
      }

      current = child;
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (node: FileTreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortNodes);
    }
  };

  sortNodes(root);
  return root;
}

// Convert Base64 string to ArrayBuffer (for binary scraped assets)
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert ArrayBuffer to Base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

