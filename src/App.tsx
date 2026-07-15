/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Terminal as TerminalIcon, 
  Globe, 
  Loader2, 
  Play, 
  Trash2, 
  FolderArchive, 
  AlertCircle,
  Code2,
  Cpu,
  Plus,
  Edit2,
  Download,
  Link2,
  Sparkles,
  RefreshCw,
  Send,
  User,
  Power,
  FolderOpen,
  FilePlus,
  BookOpen,
  Check,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

import { HostedSite, FileTreeNode, VirtualFile, BotScript } from './types';
import { saveSiteToDB, deleteSiteFromDB, loadSitesFromDB } from './db';
import { 
  getMimeType, 
  isBinaryFile, 
  buildFileTree, 
  formatBytes,
  base64ToArrayBuffer,
  arrayBufferToBase64
} from './utils';

import { sampleSiteFiles } from './data/sampleSite';
import { websiteTemplates } from './data/templates';
import { botTemplates } from './data/botTemplates';

import { FileTree } from './components/FileTree';
import { EditorPanel } from './components/EditorPanel';
import { PreviewPanel } from './components/PreviewPanel';

export default function App() {
  const [isSWReady, setIsSWReady] = useState<boolean>(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Workspace tabs: 'WEB_HOST' or 'BOT_HOST'
  const [activeTab, setActiveTab] = useState<'WEB_HOST' | 'BOT_HOST'>('WEB_HOST');

  // ----------------------------------------------------
  // MULTI-SITE WEB HOSTING STATES
  // ----------------------------------------------------
  const [sites, setSites] = useState<HostedSite[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [activePreviewPath, setActivePreviewPath] = useState<string>('index.html');
  
  // Crawler/Extractor input
  const [clonerUrl, setClonerUrl] = useState<string>('');
  const [blankSiteName, setBlankSiteName] = useState<string>('');
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [cloneSuccessMsg, setCloneSuccessMsg] = useState<string | null>(null);

  // New File modal state
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');

  // Rename File state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renameNewName, setRenameNewName] = useState<string>('');

  // ----------------------------------------------------
  // SIMULATED BOT HOSTING STATES
  // ----------------------------------------------------
  const [bots, setBots] = useState<BotScript[]>([]);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [botChatInputs, setBotChatInputs] = useState<{ [botId: string]: string }>({});
  const [chatMessages, setChatMessages] = useState<{ 
    [botId: string]: { sender: 'USER' | 'BOT' | 'SYSTEM'; text: string; timestamp: number }[] 
  }>({});
  
  // Bot compilation & execution context refs
  const botRunnersRef = useRef<{ 
    [botId: string]: { start?: Function; message?: Function; stop?: Function } 
  }>({});

  // File uploading drag/drop refs
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // APP LIFECYCLE & INITIALIZATION
  // ----------------------------------------------------

  // Register Service Worker on Startup
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[ZipHost] SW registered on scope:', registration.scope);
          const checkController = () => {
            if (navigator.serviceWorker.controller) {
              setIsSWReady(true);
            } else {
              setTimeout(checkController, 100);
            }
          };
          checkController();
        })
        .catch((err) => {
          console.error('[ZipHost] Service worker registration failed:', err);
          setError('Failed to initialize the secure browser-sandbox engine. Please reload.');
        });
    } else {
      setError('Service Workers are not supported in this browser. Hosting features are disabled.');
    }
  }, []);

  // Check backend server health on mount & periodically
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.status === 'ok') {
              setIsBackendOnline(true);
              return;
            }
          }
        }
        setIsBackendOnline(false);
      } catch (e) {
        console.warn('[ZipHost] Backend health check failed:', e);
        setIsBackendOnline(false);
      }
    };
    checkBackend();
  }, []);

  // Restore sites from IndexedDB & bots from localStorage on start
  useEffect(() => {
    const restoreData = async () => {
      // 1. Restore sites from IndexedDB
      try {
        const dbSites = await loadSitesFromDB();
        if (dbSites && dbSites.length > 0) {
          setSites(dbSites);
          setActiveSiteId(dbSites[0].id);
          
          // Set preview and select paths
          const paths = Object.keys(dbSites[0].files);
          const indexHtml = paths.find(p => p.toLowerCase() === 'index.html' || p.toLowerCase().endsWith('index.html')) || paths[0] || 'index.html';
          setActivePreviewPath(indexHtml);
          setSelectedFilePath(indexHtml);
        }
      } catch (e) {
        console.error('[ZipHost] Error restoring saved sites from IndexedDB:', e);
      }

      // 2. Restore bots from localStorage
      const savedBotsJson = localStorage.getItem('ziphost_bots');
      if (savedBotsJson) {
        try {
          const deserializedBots: BotScript[] = JSON.parse(savedBotsJson);
          setBots(deserializedBots);
          if (deserializedBots.length > 0) {
            setActiveBotId(deserializedBots[0].id);
          }
        } catch (e) {
          console.error('[ZipHost] Error restoring saved bots:', e);
        }
      } else {
        // Seed default templates
        const initialBots: BotScript[] = botTemplates.map((tpl, index) => ({
          id: `bot-${Date.now()}-${index}`,
          name: tpl.name,
          scriptValue: tpl.scriptValue,
          status: 'IDLE',
          logs: [`[SYSTEM] Bot "${tpl.name}" registered in workspace. Click toggler to boot up.`],
          env: { ...tpl.defaultEnv },
          createdAt: Date.now() - index * 1000
        }));
        setBots(initialBots);
        if (initialBots.length > 0) {
          setActiveBotId(initialBots[0].id);
        }
      }
    };

    restoreData();
  }, []);

  // Save sites to IndexedDB when updated
  const persistSites = async (updatedSites: HostedSite[]) => {
    try {
      // Save each site into IndexedDB
      for (const site of updatedSites) {
        await saveSiteToDB(site);
      }
    } catch (e) {
      console.warn('[ZipHost] IndexedDB write failed:', e);
    }
  };

  // Save bots to localStorage when updated
  const persistBots = (updatedBots: BotScript[]) => {
    try {
      localStorage.setItem('ziphost_bots', JSON.stringify(updatedBots));
    } catch (e) {
      console.error(e);
    }
  };

  // Register sites with Service Worker whenever SW is ready or active sites list changes
  useEffect(() => {
    if (isSWReady && sites.length > 0) {
      sites.forEach(site => {
        registerWithServiceWorker(site.id, site.files).catch(err => {
          console.error('[ZipHost] Registration failed for', site.name, err);
        });
      });
    }
  }, [isSWReady, sites]);

  // ----------------------------------------------------
  // SERVICE WORKER COMMUNICATION HANDLER
  // ----------------------------------------------------
  const registerWithServiceWorker = (siteId: string, files: { [path: string]: VirtualFile }) => {
    return new Promise<void>((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('Secure sandboxed virtual server is starting...'));
        return;
      }
      
      const swFiles: { [path: string]: { content: ArrayBuffer; mimeType: string } } = {};
      Object.keys(files).forEach(path => {
        swFiles[path] = {
          content: files[path].content,
          mimeType: files[path].mimeType
        };
      });
      
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data && event.data.success) {
          resolve();
        } else {
          reject(new Error('Failed to register virtual files.'));
        }
      };
      
      navigator.serviceWorker.controller.postMessage({
        type: 'REGISTER_SITE',
        siteId,
        files: swFiles
      }, [messageChannel.port2]);
    });
  };

  // ----------------------------------------------------
  // INTERACTIVE ZIP PARSING & EXTRACTOR FLOWS
  // ----------------------------------------------------
  const handleUploadedFile = async (file: File) => {
    setIsParsing(true);
    setError(null);
    
    try {
      let filesMap: { [path: string]: VirtualFile } = {};
      let entryFile = 'index.html';
      let siteName = file.name;

      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const filePaths: string[] = [];
        const promises: Promise<void>[] = [];
        
        contents.forEach((relativePath, fileItem) => {
          if (fileItem.dir) return;
          
          const promise = (async () => {
            const name = fileItem.name.split('/').pop() || fileItem.name;
            const mimeType = getMimeType(name);
            const isBinary = isBinaryFile(name, mimeType);
            const arrayBuffer = await fileItem.async('arraybuffer');
            
            let textValue: string | undefined;
            if (!isBinary) {
              textValue = await fileItem.async('string');
            }
            
            filesMap[relativePath] = {
              path: relativePath,
              name,
              mimeType,
              content: arrayBuffer,
              textValue,
              size: arrayBuffer.byteLength,
              isBinary
            };
            
            filePaths.push(relativePath);
          })();
          
          promises.push(promise);
        });
        
        await Promise.all(promises);
        
        if (filePaths.length === 0) {
          throw new Error('This ZIP archive appears to be empty.');
        }
        
        const foundEntry = filePaths.find(p => p.toLowerCase() === 'index.html') 
                         || filePaths.find(p => p.toLowerCase().endsWith('index.html'));
        
        if (foundEntry) {
          entryFile = foundEntry;
        } else {
          const firstHtml = filePaths.find(p => p.toLowerCase().endsWith('.html') || p.toLowerCase().endsWith('.htm'));
          if (firstHtml) {
            entryFile = firstHtml;
          } else if (filePaths.length > 0) {
            entryFile = filePaths[0];
          }
        }
        siteName = file.name.replace(/\.zip$/i, '');
      } else {
        // Raw file upload (e.g. index.html or another single file)
        const name = file.name;
        const mimeType = getMimeType(name);
        const isBinary = isBinaryFile(name, mimeType);
        const arrayBuffer = await file.arrayBuffer();
        
        let textValue: string | undefined;
        if (!isBinary) {
          textValue = await file.text();
        }
        
        filesMap[name] = {
          path: name,
          name,
          mimeType,
          content: arrayBuffer,
          textValue,
          size: arrayBuffer.byteLength,
          isBinary
        };
        
        // If they upload a single .html file that is not index.html, duplicate it as index.html
        // so that the default preview runs immediately!
        if (name !== 'index.html' && mimeType === 'text/html') {
          filesMap['index.html'] = {
            path: 'index.html',
            name: 'index.html',
            mimeType: 'text/html',
            content: arrayBuffer,
            textValue,
            size: arrayBuffer.byteLength,
            isBinary: false
          };
        }
        entryFile = 'index.html';
        siteName = file.name.replace(/\.(html|htm|txt|css|js)$/i, '');
      }
      
      const newSiteId = `site-${Math.random().toString(36).substring(2, 8)}`;
      await registerWithServiceWorker(newSiteId, filesMap);
      
      const newSite: HostedSite = {
        id: newSiteId,
        name: siteName,
        files: filesMap,
        createdAt: Date.now()
      };

      const updatedSites = [newSite, ...sites];
      setSites(updatedSites);
      setActiveSiteId(newSiteId);
      setActivePreviewPath(entryFile);
      setSelectedFilePath(entryFile);
      persistSites(updatedSites);
      
    } catch (err: any) {
      console.error('[ZipHost] Extraction error:', err);
      setError(err.message || 'Failed to extract or host the uploaded file.');
    } finally {
      setIsParsing(false);
    }
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // ----------------------------------------------------
  // PRO FEATURE 1: ADVANCED WEBSITE URL EXTRACTOR
  // ----------------------------------------------------
  const handleUrlCloning = async () => {
    if (!clonerUrl.trim()) return;
    setIsCloning(true);
    setCloneSuccessMsg(null);
    setError(null);

    try {
      if (isBackendOnline === false) {
        throw new Error("This hosted environment is running in Static-Only Mode. Web Extraction requires the live Node.js Express backend server. If hosted on Netlify, the server is not active. Please run locally or deploy to a container (Cloud Run) to use this feature.");
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clonerUrl })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("Invalid response received from server. The backend API is offline or hosted on a static-only provider (like Netlify) without the Express backend server.");
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Extraction failed.');
      }

      const rawData = await response.json();
      const filesMap: { [path: string]: VirtualFile } = {};
      const filePaths: string[] = [];
      const textEncoder = new TextEncoder();

      // Convert backend extracted response to client VirtualFiles
      Object.entries(rawData.files).forEach(([p, rawItem]) => {
        const item = rawItem as any;
        let arrayBuffer: ArrayBuffer;
        let textValue: string | undefined;

        if (item.isBinary) {
          arrayBuffer = base64ToArrayBuffer(item.content);
        } else {
          textValue = item.content;
          arrayBuffer = textEncoder.encode(item.content).buffer;
        }

        filesMap[p] = {
          path: p,
          name: p.split('/').pop() || p,
          mimeType: item.mimeType,
          content: arrayBuffer,
          textValue,
          size: arrayBuffer.byteLength,
          isBinary: item.isBinary
        };

        filePaths.push(p);
      });

      const newSiteId = `cloned-${Math.random().toString(36).substring(2, 8)}`;
      await registerWithServiceWorker(newSiteId, filesMap);

      // 1. Trigger dynamic client ZIP download (Pro Max automated download rule)
      const zip = new JSZip();
      Object.entries(filesMap).forEach(([p, f]) => {
        zip.file(p, f.content);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const dlLink = document.createElement('a');
      dlLink.href = URL.createObjectURL(zipBlob);
      dlLink.download = `extracted_${rawData.siteName}.zip`;
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);

      // 2. Mount/host in-app instantly for user editing
      const newSite: HostedSite = {
        id: newSiteId,
        name: `Cloned: ${rawData.siteName}`,
        files: filesMap,
        createdAt: Date.now()
      };

      const updatedSites = [newSite, ...sites];
      setSites(updatedSites);
      setActiveSiteId(newSiteId);
      setActivePreviewPath('index.html');
      setSelectedFilePath('index.html');
      persistSites(updatedSites);

      setCloneSuccessMsg(`Successfully scraped all files! ZIP downloaded automatically. You can now edit index.html or host it live.`);
      setClonerUrl('');
    } catch (e: any) {
      console.error('[Cloner Error]:', e);
      setError(e.message || 'Scraper failed to pull website source files.');
    } finally {
      setIsCloning(false);
    }
  };

  // ----------------------------------------------------
  // TEMPLATE SPAWNER
  // ----------------------------------------------------
  const handleLoadTemplate = async (template: typeof websiteTemplates[0]) => {
    setIsParsing(true);
    setError(null);

    try {
      const filesMap: { [path: string]: VirtualFile } = {};
      const encoder = new TextEncoder();

      Object.entries(template.files).forEach(([p, text]) => {
        const arrayBuffer = encoder.encode(text).buffer;
        const mimeType = getMimeType(p);

        filesMap[p] = {
          path: p,
          name: p,
          mimeType,
          content: arrayBuffer,
          textValue: text,
          size: arrayBuffer.byteLength,
          isBinary: false
        };
      });

      const newSiteId = `tpl-${Math.random().toString(36).substring(2, 8)}`;
      await registerWithServiceWorker(newSiteId, filesMap);

      const newSite: HostedSite = {
        id: newSiteId,
        name: template.name,
        files: filesMap,
        createdAt: Date.now()
      };

      const updatedSites = [newSite, ...sites];
      setSites(updatedSites);
      setActiveSiteId(newSiteId);
      setActivePreviewPath('index.html');
      setSelectedFilePath('index.html');
      persistSites(updatedSites);
    } catch (err: any) {
      console.error(err);
      setError('Failed to instantiate boilerplate template.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCreateBlankSite = async (name: string) => {
    if (!name.trim()) return;
    setIsParsing(true);
    setError(null);
    try {
      const defaultHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${name}</title>\n  <script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body class="bg-slate-900 text-white min-h-screen flex items-center justify-center">\n  <div class="text-center p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-w-md w-full">\n    <h1 class="text-3xl font-extrabold text-blue-400 mb-2">${name}</h1>\n    <p class="text-slate-400 text-sm">Successfully created! Host is live.</p>\n    <p class="text-[10px] text-slate-500 mt-4">Edit this index.html using the Web IDE code panel on the left.</p>\n  </div>\n</body>\n</html>`;
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(defaultHtml).buffer;
      const filesMap: { [path: string]: VirtualFile } = {
        'index.html': {
          path: 'index.html',
          name: 'index.html',
          mimeType: 'text/html',
          content: arrayBuffer,
          textValue: defaultHtml,
          size: arrayBuffer.byteLength,
          isBinary: false
        }
      };
      
      const newSiteId = `site-${Math.random().toString(36).substring(2, 8)}`;
      await registerWithServiceWorker(newSiteId, filesMap);
      
      const newSite: HostedSite = {
        id: newSiteId,
        name: name.trim(),
        files: filesMap,
        createdAt: Date.now()
      };
      
      const updatedSites = [newSite, ...sites];
      setSites(updatedSites);
      setActiveSiteId(newSiteId);
      setActivePreviewPath('index.html');
      setSelectedFilePath('index.html');
      persistSites(updatedSites);
    } catch (e: any) {
      console.error(e);
      setError('Failed to create blank site project.');
    } finally {
      setIsParsing(false);
    }
  };

  // ----------------------------------------------------
  // PRO FEATURE 2: DISK OPERATIONS (ADD, RENAME, DELETE, ZIP EXPORT)
  // ----------------------------------------------------
  const handleAddNewFile = () => {
    if (!activeSiteId || !newFileName.trim()) return;
    const activeSite = sites.find(s => s.id === activeSiteId);
    if (!activeSite) return;

    const path = newFileName.trim();
    const name = path.split('/').pop() || path;
    const mimeType = getMimeType(name);
    const textEncoder = new TextEncoder();
    
    let defaultContent = '';
    if (name.endsWith('.html')) {
      defaultContent = `<!DOCTYPE html>\n<html>\n<head>\n  <title>${name}</title>\n</head>\n<body>\n  <h1>Welcome to ${name}</h1>\n</body>\n</html>`;
    } else if (name.endsWith('.css')) {
      defaultContent = `/* Stylesheet for ${name} */\nbody {\n  background-color: #0f172a;\n}`;
    } else if (name.endsWith('.js')) {
      defaultContent = `// JS Logic for ${name}\nconsole.log('${name} active');`;
    }

    const content = textEncoder.encode(defaultContent).buffer;

    const updatedFiles = {
      ...activeSite.files,
      [path]: {
        path,
        name,
        mimeType,
        content,
        textValue: defaultContent,
        size: content.byteLength,
        isBinary: false
      }
    };

    const updatedSites = sites.map(s => {
      if (s.id === activeSiteId) {
        return { ...s, files: updatedFiles };
      }
      return s;
    });

    registerWithServiceWorker(activeSiteId, updatedFiles)
      .then(() => {
        setSites(updatedSites);
        setSelectedFilePath(path);
        setIsNewFileModalOpen(false);
        setNewFileName('');
        persistSites(updatedSites);
      })
      .catch(e => setError('Failed to add file.'));
  };

  const handleRenameSelectedFile = () => {
    if (!activeSiteId || !selectedFilePath || !renameNewName.trim()) return;
    const activeSite = sites.find(s => s.id === activeSiteId);
    if (!activeSite) return;

    const fileToRename = activeSite.files[selectedFilePath];
    if (!fileToRename) return;

    const newPath = renameNewName.trim();
    const newName = newPath.split('/').pop() || newPath;
    const newMimeType = getMimeType(newName);

    // Create a copy of the files, delete old, add new
    const updatedFiles = { ...activeSite.files };
    delete updatedFiles[selectedFilePath];

    updatedFiles[newPath] = {
      ...fileToRename,
      path: newPath,
      name: newName,
      mimeType: newMimeType
    };

    const updatedSites = sites.map(s => {
      if (s.id === activeSiteId) {
        return { ...s, files: updatedFiles };
      }
      return s;
    });

    registerWithServiceWorker(activeSiteId, updatedFiles)
      .then(() => {
        setSites(updatedSites);
        setSelectedFilePath(newPath);
        if (activePreviewPath === selectedFilePath) {
          setActivePreviewPath(newPath);
        }
        setIsRenameModalOpen(false);
        setRenameNewName('');
        persistSites(updatedSites);
      })
      .catch(e => setError('Failed to rename file.'));
  };

  const handleDeleteSelectedFile = () => {
    if (!activeSiteId || !selectedFilePath) return;
    const activeSite = sites.find(s => s.id === activeSiteId);
    if (!activeSite) return;

    if (selectedFilePath === 'index.html' && !window.confirm('Deleting index.html might break the direct preview loader. Proceed?')) {
      return;
    }

    const updatedFiles = { ...activeSite.files };
    delete updatedFiles[selectedFilePath];

    const updatedSites = sites.map(s => {
      if (s.id === activeSiteId) {
        return { ...s, files: updatedFiles };
      }
      return s;
    });

    registerWithServiceWorker(activeSiteId, updatedFiles)
      .then(() => {
        setSites(updatedSites);
        const remaining = Object.keys(updatedFiles);
        if (remaining.length > 0) {
          setSelectedFilePath(remaining[0]);
          if (activePreviewPath === selectedFilePath) {
            setActivePreviewPath(remaining[0]);
          }
        } else {
          setSelectedFilePath(null);
        }
        persistSites(updatedSites);
      })
      .catch(e => setError('Failed to delete file.'));
  };

  const handleExportZip = async () => {
    if (!activeSiteId) return;
    const activeSite = sites.find(s => s.id === activeSiteId);
    if (!activeSite) return;

    const zip = new JSZip();
    Object.entries(activeSite.files).forEach(([p, rawF]) => {
      const f = rawF as any;
      zip.file(p, f.content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const dlLink = document.createElement('a');
    dlLink.href = URL.createObjectURL(blob);
    dlLink.download = `${activeSite.name}_edited.zip`;
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
  };

  // Save content callback from editor
  const handleSaveContent = (path: string, newText: string) => {
    if (!activeSiteId) return;
    const activeSite = sites.find(s => s.id === activeSiteId);
    if (!activeSite) return;

    const encoder = new TextEncoder();
    const content = encoder.encode(newText).buffer;

    const updatedFiles = {
      ...activeSite.files,
      [path]: {
        ...activeSite.files[path],
        content,
        textValue: newText,
        size: content.byteLength
      }
    };

    const updatedSites = sites.map(s => {
      if (s.id === activeSiteId) {
        return { ...s, files: updatedFiles };
      }
      return s;
    });

    registerWithServiceWorker(activeSiteId, updatedFiles)
      .then(() => {
        setSites(updatedSites);
        if (path === activePreviewPath) {
          // Trigger preview reload
          setActivePreviewPath('');
          setTimeout(() => setActivePreviewPath(path), 50);
        }
        persistSites(updatedSites);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to apply source edits to browser host scope.');
      });
  };

  const handleSelectFile = (path: string) => {
    setSelectedFilePath(path);
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      setActivePreviewPath(path);
    }
  };

  const handleUnloadSite = (siteId: string) => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UNREGISTER_SITE',
        siteId
      });
    }
    const updated = sites.filter(s => s.id !== siteId);
    setSites(updated);
    if (activeSiteId === siteId) {
      if (updated.length > 0) {
        setActiveSiteId(updated[0].id);
      } else {
        setActiveSiteId(null);
        setSelectedFilePath(null);
      }
    }
    persistSites(updated);
  };

  const getActiveSite = (): HostedSite | null => {
    return sites.find(s => s.id === activeSiteId) || null;
  };

  const getSelectedFileObject = (): VirtualFile | null => {
    const activeSite = getActiveSite();
    if (!activeSite || !selectedFilePath) return null;
    return activeSite.files[selectedFilePath] || null;
  };

  // Convert files list to a static context for the AI Copilot
  const getProjectContextMap = (): { [path: string]: string } => {
    const activeSite = getActiveSite();
    if (!activeSite) return {};
    const map: { [path: string]: string } = {};
    Object.entries(activeSite.files).forEach(([p, f]) => {
      if (!f.isBinary && f.textValue) {
        map[p] = f.textValue;
      }
    });
    return map;
  };

  // ----------------------------------------------------
  // PRO FEATURE 3: JAVASCRIPT BOT HOSTING WORKSPACE
  // ----------------------------------------------------
  const handleCreateNewBot = () => {
    const newBot: BotScript = {
      id: `bot-${Date.now()}`,
      name: `Custom Bot #${bots.length + 1}`,
      scriptValue: `// Write your virtual JavaScript bot code here!\n\nbot.on('start', () => {\n  bot.log('🟢 Custom Bot successfully started!');\n});\n\nbot.on('message', (message) => {\n  bot.log(\`📥 Message received: "\${message.text}" from \${message.sender}\`);\n  bot.sendReply('Hello! I am your custom browser-sandbox bot.');\n});\n`,
      status: 'IDLE',
      logs: ['[SYSTEM] Workspace initiated. Click "Boot Bot Server" to host.'],
      env: { "ADMIN_ID": "1000", "PREFIX": "/" },
      createdAt: Date.now()
    };
    const updated = [newBot, ...bots];
    setBots(updated);
    setActiveBotId(newBot.id);
    persistBots(updated);
  };

  const handleDeleteBot = (botId: string) => {
    // If running, turn off first
    handleToggleBotServer(botId, false);
    const updated = bots.filter(b => b.id !== botId);
    setBots(updated);
    if (activeBotId === botId) {
      if (updated.length > 0) {
        setActiveBotId(updated[0].id);
      } else {
        setActiveBotId(null);
      }
    }
    persistBots(updated);
  };

  const handleBotScriptChange = (botId: string, value: string) => {
    const updated = bots.map(b => {
      if (b.id === botId) {
        return { ...b, scriptValue: value };
      }
      return b;
    });
    setBots(updated);
    persistBots(updated);
  };

  const handleBotEnvChange = (botId: string, key: string, val: string) => {
    const updated = bots.map(b => {
      if (b.id === botId) {
        return {
          ...b,
          env: { ...b.env, [key]: val }
        };
      }
      return b;
    });
    setBots(updated);
    persistBots(updated);
  };

  // Compiles and Toggles simulated hosting runtime client-side
  const handleToggleBotServer = (botId: string, forceStart?: boolean) => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    const isStarting = forceStart !== undefined ? forceStart : (bot.status !== 'RUNNING');

    if (isStarting) {
      // 1. Boot sequence
      const runners = botRunnersRef.current;
      const eventHandlers: { start?: Function; message?: Function; stop?: Function } = {};
      const botIntervals: number[] = [];
      const botTimeouts: number[] = [];
      
      const appendBotLog = (msg: string) => {
        setBots(prevBots => prevBots.map(b => {
          if (b.id === botId) {
            return {
              ...b,
              logs: [...b.logs, `[${new Date().toLocaleTimeString()}] ${msg}`]
            };
          }
          return b;
        }));
      };

      const sendBotReplyInChat = (replyText: string) => {
        setChatMessages(prev => {
          const prevMsg = prev[botId] || [];
          return {
            ...prev,
            [botId]: [...prevMsg, { sender: 'BOT', text: replyText, timestamp: Date.now() }]
          };
        });
      };

      // Virtual Environment mapping object passed to Bot compile block
      const botContext = {
        env: bot.env,
        log: (text: string) => appendBotLog(text),
        on: (event: 'start' | 'message' | 'stop', callback: Function) => {
          eventHandlers[event] = callback;
        },
        sendReply: (text: string) => sendBotReplyInChat(text),
        getAI: async (prompt: string, callback: (reply: string) => void) => {
          try {
            if (isBackendOnline === false) {
              throw new Error("Gemini AI is offline. This environment is running in Static-Only Mode (no backend server). Please deploy to Cloud Run or run the backend server.");
            }
            appendBotLog(`🤖 Contacting server-side Gemini AI proxy...`);
            const res = await fetch('/api/bot/ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
            });
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error("Invalid response received. The backend server is offline or not configured.");
            }
            const data = await res.json();
            callback(data.reply || "No response received.");
          } catch (err: any) {
            appendBotLog(`❌ Bot AI request failed: ${err.message}`);
            callback(`[AI Error: ${err.message || 'Service offline'}]`);
          }
        },
        setInterval: (fn: Function, delay: number) => {
          const id = window.setInterval(() => {
            try {
              fn();
            } catch (e: any) {
              appendBotLog(`⚠️ Interval runtime crash: ${e.message}`);
            }
          }, delay);
          botIntervals.push(id);
          return id;
        },
        setTimeout: (fn: Function, delay: number) => {
          const id = window.setTimeout(() => {
            try {
              fn();
            } catch (e: any) {
              appendBotLog(`⚠️ Timeout runtime crash: ${e.message}`);
            }
          }, delay);
          botTimeouts.push(id);
          return id;
        }
      };

      appendBotLog(`⚙️ Preparing container environment sandbox...`);
      appendBotLog(`📦 Memory limits set. Linking runtime event observers...`);

      try {
        // Compile JS script inside browser sandbox
        const compiler = new Function('bot', bot.scriptValue);
        compiler(botContext);
        
        // Save handlers to ref along with intervals and timeouts for reliable cleanup
        runners[botId] = {
          ...eventHandlers,
          _intervals: botIntervals,
          _timeouts: botTimeouts
        } as any;

        // Set state to RUNNING
        setBots(prev => prev.map(b => b.id === botId ? { ...b, status: 'RUNNING' } : b));
        
        appendBotLog(`✅ Runtime fully operational. Listening to events...`);

        // Trigger 'start' event callback if provided
        if (eventHandlers.start) {
          eventHandlers.start();
        }

      } catch (err: any) {
        appendBotLog(`❌ COMPILE/RUNTIME CRASH: ${err.message}`);
        setBots(prev => prev.map(b => b.id === botId ? { ...b, status: 'CRASHED' } : b));
        
        // Clear anything that might have scheduled before crash
        botIntervals.forEach(window.clearInterval);
        botTimeouts.forEach(window.clearTimeout);
      }

    } else {
      // 2. Shut down sequence
      const runner = botRunnersRef.current[botId] as any;
      if (runner) {
        // Clear all background intervals and timeouts immediately
        if (runner._intervals) {
          runner._intervals.forEach(window.clearInterval);
        }
        if (runner._timeouts) {
          runner._timeouts.forEach(window.clearTimeout);
        }
        if (runner.stop) {
          try {
            runner.stop();
          } catch (e: any) {
            console.warn('Error in bot stop trigger:', e);
          }
        }
      }

      delete botRunnersRef.current[botId];

      setBots(prevBots => prevBots.map(b => {
        if (b.id === botId) {
          return {
            ...b,
            status: 'IDLE',
            logs: [...b.logs, `[SYSTEM] Bot shutdown initiated. Virtual ports closed.`]
          };
        }
        return b;
      }));
    }
  };

  // Chat sandbox interaction submit
  const handleSendMockChatMessage = (botId: string) => {
    const input = botChatInputs[botId] || '';
    if (!input.trim()) return;

    // Append user's message
    const newMessage = { sender: 'USER' as const, text: input, timestamp: Date.now() };
    setChatMessages(prev => {
      const prevMsg = prev[botId] || [];
      return {
        ...prev,
        [botId]: [...prevMsg, newMessage]
      };
    });

    setBotChatInputs(prev => ({ ...prev, [botId]: '' }));

    // Send trigger to bot message handler if server is running
    const bot = bots.find(b => b.id === botId);
    if (bot && bot.status === 'RUNNING') {
      const runner = botRunnersRef.current[botId];
      if (runner && runner.message) {
        try {
          runner.message({ text: input, sender: 'User' });
        } catch (e: any) {
          setBots(prev => prev.map(b => {
            if (b.id === botId) {
              return {
                ...b,
                status: 'CRASHED',
                logs: [...b.logs, `[RUNTIME ERROR on message]: ${e.message}`]
              };
            }
            return b;
          }));
        }
      } else {
        // Logging system warning
        setBots(prev => prev.map(b => {
          if (b.id === botId) {
            return {
              ...b,
              logs: [...b.logs, `[WARNING] Message ignored. Script did not register bot.on('message', callback)`]
            };
          }
          return b;
        }));
      }
    }
  };

  const getActiveBot = (): BotScript | null => {
    return bots.find(b => b.id === activeBotId) || null;
  };

  // ----------------------------------------------------
  // RENDER COMPONENT
  // ----------------------------------------------------
  const activeSite = getActiveSite();
  const fileTreeRoot = activeSite ? buildFileTree(Object.keys(activeSite.files)) : null;
  const activeBot = getActiveBot();

  return (
    <div id="app-root" className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* Top Header Control Area */}
      <header className="flex-shrink-0 px-6 py-4 bg-slate-950/80 border-b border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/15">
            <Code2 className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-display text-slate-100 flex items-center gap-2">
              ZipHost <span className="text-[10px] bg-blue-500/10 text-blue-400 font-mono font-bold px-2 py-0.5 rounded-full border border-blue-500/20">PRO MAX v2.0</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Static Web Hosting, Web Scraping & Simulated JS Bot Container Playground</p>
          </div>
        </div>

        {/* Global Workspace Tab Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('WEB_HOST')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'WEB_HOST'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Static Web IDE</span>
          </button>
          <button
            onClick={() => setActiveTab('BOT_HOST')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'BOT_HOST'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>JS Bot Sandbox</span>
          </button>
        </div>

        {/* Liveness Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-400" title="Local browser sandboxed virtual server">
            <span className={`w-2 h-2 rounded-full ${isSWReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>Sandbox: {isSWReady ? 'READY' : 'BOOTING'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-400" title="Server-side scraping & AI engine status">
            <span className={`w-2 h-2 rounded-full ${isBackendOnline === true ? 'bg-emerald-500 animate-pulse' : isBackendOnline === false ? 'bg-rose-500' : 'bg-amber-500'}`} />
            <span>Backend: {isBackendOnline === true ? 'ONLINE' : isBackendOnline === false ? 'OFFLINE (Static Mode)' : 'CHECKING...'}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 overflow-hidden min-h-0 p-6 flex flex-col">
        {activeTab === 'WEB_HOST' ? (
          /* ==================================================================== */
          /* STATIC WEB HOSTING WORKSPACE                                         */
          /* ==================================================================== */
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            {/* Top Toolbar: Render compact controls if site active, otherwise render Master Hub */}
            {activeSite && (
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-900 shadow-xl">
                {/* Site Workspace Switcher with Back Button */}
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setActiveSiteId(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-md flex-shrink-0"
                    title="Return to Sites Hub Dashboard"
                  >
                    ← Dashboard
                  </button>
                  <div className="h-4 w-[1px] bg-slate-800 flex-shrink-0" />
                  <FolderOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <select
                    value={activeSiteId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setActiveSiteId(id || null);
                      const site = sites.find(s => s.id === id);
                      if (site) {
                        const keys = Object.keys(site.files);
                        const entry = keys.find(k => k.endsWith('index.html')) || keys[0] || null;
                        setSelectedFilePath(entry);
                        if (entry) setActivePreviewPath(entry);
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-mono max-w-[200px]"
                  >
                    <option value="" disabled>Select project...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({Object.keys(s.files).length} files)</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUnloadSite(activeSite.id)}
                    className="p-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded-lg hover:border-red-900/60 transition-all cursor-pointer flex-shrink-0"
                    title="Unload this site"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Compact IDE Cloner / Link extractor */}
                <div className="flex-1 flex flex-col sm:flex-row gap-2 max-w-2xl">
                  <div className="flex-1 flex items-center bg-slate-900 px-3 py-1 border border-slate-800 rounded-lg focus-within:border-blue-500/40 transition-all">
                    <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mr-2" />
                    <input
                      type="text"
                      placeholder="Enter website URL to extract (auto-downloads bundle)"
                      value={clonerUrl}
                      onChange={(e) => setClonerUrl(e.target.value)}
                      className="flex-1 bg-transparent border-none text-xs text-slate-355 outline-none focus:ring-0 placeholder-slate-600 font-mono"
                      disabled={isCloning}
                    />
                  </div>
                  <button
                    onClick={handleUrlCloning}
                    disabled={isCloning || !clonerUrl.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    {isCloning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Extract Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error notifications */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {cloneSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{cloneSuccessMsg}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {!activeSite ? (
                /* ==================================================================== */
                /* HIGH END SITES HUB DASHBOARD (Unloaded State)                        */
                /* ==================================================================== */
                <motion.div
                  key="no-site-pane"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1"
                >
                  {/* Extractor Hero Console */}
                  <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-900 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="flex flex-col gap-4">
                      <div>
                        <h2 className="text-base font-bold tracking-tight font-display text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                          Web Extractor & Source Code Downloader
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Enter any public website address. ZipHost will extract its full assets and trigger an automatic ZIP backup download!
                        </p>
                      </div>

                      {isBackendOnline === false && (
                        <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-300 leading-relaxed max-w-2xl">
                          <AlertCircle className="w-4.5 h-4.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block mb-0.5 text-amber-200">Static-Only Hosting Mode Active</span>
                            This application is hosted on a static-only platform (like Netlify) without its Node.js backend. 
                            <strong> Web Extraction, scraping, and Gemini AI code-generation are offline</strong>. 
                            Please deploy this project to Google Cloud Run to unlock full-stack features. In the meantime, you can still upload ZIP files, create blank projects, and host/preview them locally with our offline Service Worker Sandbox!
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="flex-1 flex items-center bg-slate-900 px-3.5 py-2 border border-slate-800 rounded-xl focus-within:border-blue-500/50 transition-all shadow-inner">
                          <Link2 className="w-4 h-4 text-slate-500 flex-shrink-0 mr-2.5" />
                          <input
                            type="text"
                            placeholder="e.g. https://tailwindcss.com or play.google.com"
                            value={clonerUrl}
                            onChange={(e) => setClonerUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && clonerUrl.trim() && !isCloning && handleUrlCloning()}
                            className="flex-1 bg-transparent border-none text-xs text-slate-200 outline-none focus:ring-0 placeholder-slate-600 font-mono"
                            disabled={isCloning}
                          />
                        </div>
                        <button
                          onClick={handleUrlCloning}
                          disabled={isCloning || !clonerUrl.trim()}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/15"
                        >
                          {isCloning ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Extracting website...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Extract & Auto-Download</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Drag/Drop Ingress & Creation Sandbox */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Upload or Create Blank */}
                    <div className="xl:col-span-7 flex flex-col bg-slate-950/30 border border-slate-900 rounded-2xl p-6 gap-5">
                      <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-blue-400" />
                        Deploy Custom Project
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Drag-drop or click to upload ZIP */}
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-6 rounded-xl border border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[160px] ${
                            isDragging
                              ? 'border-blue-500 bg-blue-950/20 shadow-lg'
                              : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/40'
                          }`}
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => e.target.files && handleUploadedFile(e.target.files[0])}
                            accept=".zip,.html,.htm"
                            className="hidden"
                          />
                          {isParsing ? (
                            <div className="flex flex-col items-center">
                              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                              <p className="text-[11px] font-bold text-slate-300">Parsing bundle...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <UploadCloud className="w-8 h-8 text-slate-500 mb-2 animate-bounce" />
                              <p className="text-[11px] font-bold text-slate-300">Upload ZIP or HTML</p>
                              <p className="text-[9px] text-slate-500 mt-1.5 leading-relaxed">Drag-drop your archive or a single file to host instantly.</p>
                            </div>
                          )}
                        </div>

                        {/* Create Blank Workspace from Scratch */}
                        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/20 flex flex-col justify-between gap-3 min-h-[160px]">
                          <div>
                            <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-blue-400" />
                              Create Blank Project
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                              Spin up an empty index.html project preconfigured with Tailwind CSS classes in seconds.
                            </p>
                          </div>

                          <div className="flex gap-1.5 mt-2">
                            <input
                              type="text"
                              placeholder="Project name (e.g. App)"
                              value={blankSiteName}
                              onChange={(e) => setBlankSiteName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && blankSiteName.trim() && (handleCreateBlankSite(blankSiteName).then(() => setBlankSiteName('')))}
                              className="flex-1 bg-slate-950 text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-850 outline-none text-slate-300 placeholder-slate-600 font-mono"
                            />
                            <button
                              onClick={() => {
                                handleCreateBlankSite(blankSiteName);
                                setBlankSiteName('');
                              }}
                              disabled={!blankSiteName.trim()}
                              className="px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Starter Templates */}
                    <div className="xl:col-span-5">
                      <div className="bg-slate-950/30 border border-slate-900 rounded-2xl p-6 flex flex-col gap-4 h-full max-h-[254px]">
                        <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-indigo-400" />
                          1-Click Boilerplate Hub
                        </h3>

                        <div className="flex-1 overflow-auto pr-1 space-y-2.5">
                          {websiteTemplates.map((tpl) => (
                            <div
                              key={tpl.name}
                              className="p-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-800/80 rounded-xl flex items-center justify-between gap-3 transition-all"
                            >
                              <div className="min-w-0">
                                <h4 className="text-[11px] font-bold text-slate-200 truncate">{tpl.name}</h4>
                                <p className="text-[9px] text-slate-500 mt-0.5 leading-tight truncate">{tpl.description}</p>
                              </div>
                              <button
                                onClick={() => handleLoadTemplate(tpl)}
                                className="flex-shrink-0 px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Launch
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Virtual Hosts list */}
                  {sites.length > 0 && (
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
                          📡 PORTFOLIO & LIVE VIRTUAL HOSTS ({sites.length} Active)
                        </h3>
                        <span className="text-[10px] text-slate-600 font-mono">Service worker container status: ACTIVE</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {sites.map((site) => {
                          const keys = Object.keys(site.files);
                          const indexHtml = keys.find(k => k.endsWith('index.html')) || keys[0] || 'index.html';
                          const totalBytes = Object.values(site.files).reduce((sum: number, f) => sum + (f as any).size, 0) as number;

                          return (
                            <motion.div
                              key={site.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-slate-950/50 border border-slate-900 hover:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
                            >
                              {/* Background subtle visual accent */}
                              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-600/3 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="text-sm font-bold text-slate-100 font-display group-hover:text-blue-400 transition-colors truncate">
                                    {site.name}
                                  </h4>
                                  <span className="text-[9px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded-full font-mono text-slate-500 flex-shrink-0">
                                    ID: {site.id}
                                  </span>
                                </div>

                                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                  Created {new Date(site.createdAt).toLocaleDateString()}
                                </p>

                                <div className="mt-4 flex items-center gap-3 text-[10px] font-mono text-slate-400 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
                                  <div className="flex flex-col">
                                    <span className="text-slate-600 font-bold uppercase text-[8px]">Assets</span>
                                    <span className="text-slate-200 mt-0.5">{keys.length} Files</span>
                                  </div>
                                  <div className="h-6 w-[1px] bg-slate-850" />
                                  <div className="flex flex-col">
                                    <span className="text-slate-600 font-bold uppercase text-[8px]">Total Size</span>
                                    <span className="text-slate-200 mt-0.5">{formatBytes(totalBytes)}</span>
                                  </div>
                                  <div className="h-6 w-[1px] bg-slate-850" />
                                  <div className="flex flex-col">
                                    <span className="text-slate-600 font-bold uppercase text-[8px]">Status</span>
                                    <span className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                      Live
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons footer */}
                              <div className="grid grid-cols-12 gap-1.5 pt-2.5 border-t border-slate-900/60 mt-1">
                                <button
                                  onClick={() => {
                                    setActiveSiteId(site.id);
                                    setSelectedFilePath(indexHtml);
                                    setActivePreviewPath(indexHtml);
                                  }}
                                  className="col-span-6 px-3 py-2 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/10 hover:border-blue-500/30 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                                >
                                  <Code2 className="w-3.5 h-3.5" />
                                  <span>Open IDE</span>
                                </button>

                                <a
                                  href={`/hosted/${site.id}/${indexHtml}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="col-span-3 px-2 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  title="Open live hosted page in a new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>

                                <button
                                  onClick={async () => {
                                    const zip = new JSZip();
                                    Object.entries(site.files).forEach(([p, rawF]) => {
                                      const f = rawF as any;
                                      zip.file(p, f.content);
                                    });
                                    const blob = await zip.generateAsync({ type: 'blob' });
                                    const dlLink = document.createElement('a');
                                    dlLink.href = URL.createObjectURL(blob);
                                    dlLink.download = `${site.name}_export.zip`;
                                    document.body.appendChild(dlLink);
                                    dlLink.click();
                                    document.body.removeChild(dlLink);
                                  }}
                                  className="col-span-3 px-2 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  title="Download project as ZIP backup"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleUnloadSite(site.id)}
                                  className="col-span-12 mt-1 py-1.5 bg-red-950/15 hover:bg-red-950/35 text-red-400 hover:text-red-300 border border-red-900/10 hover:border-red-900/30 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Virtual Project</span>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                /* ==================================================================== */
                /* FULL INTERACTIVE WORKSPACE IDE PANEL (Active Site State)             */
                /* ==================================================================== */
                <motion.div
                  key="ide-pane"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0"
                >
                  {/* Left Column: File Explorer Panel */}
                  <div className="lg:col-span-3 flex flex-col bg-slate-950/40 rounded-xl border border-slate-900/80 overflow-hidden min-h-[250px] lg:min-h-0">
                    <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-900/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FolderArchive className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-200 truncate font-mono">{activeSite.name}</span>
                      </div>

                      {/* Tool bar actions for new/delete/rename */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setIsNewFileModalOpen(true)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          title="Create New File"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                        </button>
                        {selectedFilePath && (
                          <>
                            <button
                              onClick={() => {
                                setRenameNewName(selectedFilePath);
                                setIsRenameModalOpen(true);
                              }}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                              title="Rename File"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleDeleteSelectedFile}
                              className="p-1 hover:bg-red-950/20 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete Selected File"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={handleExportZip}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          title="Export Site as ZIP"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* New File Modal Trigger Inline */}
                    {isNewFileModalOpen && (
                      <div className="p-3 bg-slate-900/40 border-b border-slate-900/80 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-400">CREATE NEW VIRTUAL FILE</span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="e.g. css/style.css"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNewFile()}
                            className="flex-1 bg-slate-950 text-xs px-2 py-1 rounded border border-slate-800 outline-none text-slate-300 font-mono"
                          />
                          <button
                            onClick={handleAddNewFile}
                            className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => setIsNewFileModalOpen(false)}
                          className="text-[9px] text-slate-500 text-left hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Rename Modal Inline */}
                    {isRenameModalOpen && (
                      <div className="p-3 bg-slate-900/40 border-b border-slate-900/80 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-400">RENAME FILE</span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={renameNewName}
                            onChange={(e) => setRenameNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameSelectedFile()}
                            className="flex-1 bg-slate-950 text-xs px-2 py-1 rounded border border-slate-800 outline-none text-slate-300 font-mono"
                          />
                          <button
                            onClick={handleRenameSelectedFile}
                            className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => setIsRenameModalOpen(false)}
                          className="text-[9px] text-slate-500 text-left hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="flex-1 overflow-auto p-3 space-y-1">
                      {fileTreeRoot && (
                        <FileTree
                          node={fileTreeRoot}
                          files={activeSite.files}
                          selectedPath={selectedFilePath}
                          onSelectFile={handleSelectFile}
                        />
                      )}
                    </div>

                    <div className="p-3 bg-slate-900/20 border-t border-slate-900/60 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                      <span>Files: {Object.keys(activeSite.files).length}</span>
                      <span>Total: {formatBytes((Object.values(activeSite.files) as VirtualFile[]).reduce((sum, f) => sum + f.size, 0))}</span>
                    </div>
                  </div>

                  {/* Middle Column: Editor Panel */}
                  <div className="lg:col-span-4 min-h-[350px] lg:min-h-0">
                    <EditorPanel
                      file={getSelectedFileObject()}
                      onSaveContent={handleSaveContent}
                      projectContext={getProjectContextMap()}
                      isBackendOnline={isBackendOnline}
                    />
                  </div>

                  {/* Right Column: Preview Panel */}
                  <div className="lg:col-span-5 min-h-[450px] lg:min-h-0">
                    <PreviewPanel
                      siteId={activeSite.id}
                      activePath={activePreviewPath}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ==================================================================== */
          /* JAVASCRIPT BOT HOSTING WORKSPACE                                     */
          /* ==================================================================== */
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
            {/* Left Sidebar: Bots List */}
            <div className="lg:col-span-3 flex flex-col bg-slate-950/40 border border-slate-900 rounded-xl overflow-hidden min-h-[200px] lg:min-h-0">
              <div className="p-4 bg-slate-900/60 border-b border-slate-900/80 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>BOT INSTANCES</span>
                </div>
                <button
                  onClick={handleCreateNewBot}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Create Bot</span>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-3 space-y-2">
                {bots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => setActiveBotId(bot.id)}
                    className={`w-full p-3 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      activeBotId === bot.id
                        ? 'bg-indigo-600/10 border-indigo-500 text-slate-200'
                        : 'bg-slate-900/30 border-slate-900/80 hover:bg-slate-900/60 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold font-mono truncate">{bot.name}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                        bot.status === 'RUNNING'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : bot.status === 'CRASHED'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-slate-800 text-slate-500 border-slate-750'
                      }`}>
                        {bot.status}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 truncate">Created {new Date(bot.createdAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Middle & Right: Code Editor & Live Chat Test Console */}
            <AnimatePresence mode="wait">
              {activeBot ? (
                <motion.div
                  key="bot-ide"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0"
                >
                  {/* Script Code Editor */}
                  <div className="md:col-span-7 flex flex-col bg-slate-950/40 border border-slate-900 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-900/80 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{activeBot.name} code</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-mono">bot_script.js (Interpreted sandbox)</p>
                      </div>

                      {/* Power Trigger switch */}
                      <button
                        onClick={() => handleToggleBotServer(activeBot.id)}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                          activeBot.status === 'RUNNING'
                            ? 'bg-red-600 hover:bg-red-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{activeBot.status === 'RUNNING' ? 'Shutdown Bot' : 'Boot Bot Server'}</span>
                      </button>
                    </div>

                    <div className="flex-1 bg-slate-950 p-4 font-mono relative">
                      <textarea
                        value={activeBot.scriptValue}
                        onChange={(e) => handleBotScriptChange(activeBot.id, e.target.value)}
                        className="w-full h-full outline-none bg-transparent text-slate-300 resize-none font-mono text-xs leading-relaxed"
                        style={{ tabSize: 2 }}
                        spellCheck={false}
                      />
                    </div>

                    {/* Environment variables config section */}
                    <div className="p-4 bg-slate-900/30 border-t border-slate-900/80 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-slate-400">MOCK ENVIRONMENT VARIABLES (bot.env.*)</span>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(activeBot.env).map(([k, v]) => (
                          <div key={k} className="flex gap-1">
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-950 px-1.5 py-1 rounded border border-slate-900">{k}:</span>
                            <input
                              type="text"
                              value={v}
                              onChange={(e) => handleBotEnvChange(activeBot.id, k, e.target.value)}
                              className="flex-1 bg-slate-950 text-xs px-2 py-0.5 rounded border border-slate-850 outline-none text-slate-300 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Terminal Logs & Interactive Mock Chat Portal */}
                  <div className="md:col-span-5 flex flex-col gap-6 min-h-0">
                    {/* Live Logs Terminal */}
                    <div className="flex-1 flex flex-col bg-[#05050c] border border-slate-900 rounded-xl overflow-hidden h-[240px]">
                      <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-900/80 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <TerminalIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>BOT CONSOLE LOGS</span>
                        </span>
                        <button
                          onClick={() => {
                            setBots(prev => prev.map(b => b.id === activeBot.id ? { ...b, logs: [] } : b));
                          }}
                          className="text-[9px] text-slate-500 hover:text-slate-300 hover:underline cursor-pointer"
                        >
                          Clear Output
                        </button>
                      </div>

                      <div className="flex-1 p-4 font-mono text-[10px] text-slate-300 overflow-auto space-y-1 bg-black/40">
                        {activeBot.logs.map((log, index) => (
                          <p key={index} className="leading-relaxed whitespace-pre-wrap">{log}</p>
                        ))}
                      </div>
                    </div>

                    {/* Chat Portal Sandbox */}
                    <div className="flex-1 flex flex-col bg-slate-950/60 border border-slate-900 rounded-xl overflow-hidden h-[260px]">
                      <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-900/80 text-[10px] font-bold text-indigo-400">
                        💬 BOT INTERACTION PORTAL
                      </div>

                      {/* Chat messages lists */}
                      <div className="flex-1 p-4 overflow-auto space-y-3 flex flex-col">
                        {(chatMessages[activeBot.id] || []).map((msg, index) => (
                          <div
                            key={index}
                            className={`flex flex-col max-w-[80%] rounded-2xl p-2.5 text-xs ${
                              msg.sender === 'USER'
                                ? 'bg-blue-600 text-white self-end rounded-br-none'
                                : 'bg-slate-900 text-slate-300 self-start rounded-bl-none border border-slate-850'
                            }`}
                          >
                            <span className="text-[8px] opacity-60 flex items-center gap-1 font-bold mb-1">
                              {msg.sender === 'USER' ? <User className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                              <span>{msg.sender === 'USER' ? 'User Developer' : activeBot.name}</span>
                            </span>
                            <p className="leading-normal">{msg.text}</p>
                          </div>
                        ))}
                        {(chatMessages[activeBot.id] || []).length === 0 && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600 p-4">
                            <Send className="w-8 h-8 text-slate-800 mb-2" />
                            <p className="text-[11px] font-bold">Interact with your Bot!</p>
                            <p className="text-[10px] mt-0.5 leading-relaxed">Ensure bot is booting, then send text prompts to test trigger callbacks.</p>
                          </div>
                        )}
                      </div>

                      {/* Message Input bar */}
                      <div className="p-3 bg-slate-900/50 border-t border-slate-900 flex gap-1.5 items-center">
                        <input
                          type="text"
                          placeholder={activeBot.status === 'RUNNING' ? "Type message and test responder bot..." : "Boot bot first to send messages"}
                          value={botChatInputs[activeBot.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBotChatInputs(prev => ({ ...prev, [activeBot.id]: val }));
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMockChatMessage(activeBot.id)}
                          className="flex-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-all font-sans"
                          disabled={activeBot.status !== 'RUNNING'}
                        />
                        <button
                          onClick={() => handleSendMockChatMessage(activeBot.id)}
                          disabled={activeBot.status !== 'RUNNING' || !(botChatInputs[activeBot.id] || '').trim()}
                          className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="lg:col-span-9 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <Cpu className="w-12 h-12 text-slate-800 mb-3" />
                  <h4 className="text-sm font-semibold">No Bot Selected</h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
                    Choose an existing bot instance or click "Create Bot" to start coding automation scripts.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
