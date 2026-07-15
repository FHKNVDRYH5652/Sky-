/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VirtualFile {
  path: string;       // e.g., "css/style.css"
  name: string;       // e.g., "style.css"
  mimeType: string;   // e.g., "text/css"
  content: ArrayBuffer; // Binary content for the Service Worker
  textValue?: string; // Cache text for editable files
  size: number;       // in bytes
  isBinary: boolean;  // Whether the file is binary (images, fonts) or text (html, css, js)
}

export interface HostedSite {
  id: string;         // e.g., "site-12345"
  name: string;       // ZIP filename or custom title
  files: { [path: string]: VirtualFile };
  createdAt: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}
