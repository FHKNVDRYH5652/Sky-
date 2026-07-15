/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Terminal, 
  Globe, 
  Loader2, 
  Play, 
  Trash2, 
  FolderArchive, 
  AlertCircle,
  Code2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

import { HostedSite, FileTreeNode, VirtualFile } from './types';
import { getMimeType, isBinaryFile, buildFileTree, formatBytes } from './utils';
import { sampleSiteFiles } from './data/sampleSite';
import { FileTree } from './components/FileTree';
import { EditorPanel } from './components/EditorPanel';
import { PreviewPanel } from './components/PreviewPanel';

export default function App() {
  const [isSWReady, setIsSWReady] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // App state
  const [hostedSite, setHostedSite] = useState<HostedSite | null>(null);
  const [fileTreeRoot, setFileTreeRoot] = useState<FileTreeNode | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string>('index.html');
  
  // Drag & drop visual state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register Service Worker on Startup
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[ZipHost] SW registered on scope:', registration.scope);
          
          // Wait and check for controlling instance
          const checkController = () => {
            if (navigator.serviceWorker.controller) {
              setIsSWReady(true);
            } else {
              // Wait or force claim
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

  // Post the files mapping to the Service Worker
  const registerWithServiceWorker = (siteId: string, files: { [path: string]: VirtualFile }) => {
    return new Promise<void>((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('Secure sandboxed virtual server is still starting. Please wait a moment.'));
        return;
      }
      
      // Structure content safely for SW transfer
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
          reject(new Error('Failed to cache files inside virtual host.'));
        }
      };
      
      navigator.serviceWorker.controller.postMessage({
        type: 'REGISTER_SITE',
        siteId,
        files: swFiles
      }, [messageChannel.port2]);
    });
  };

  // ZIP file handling and extraction
  const handleZipFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Invalid file format. Please upload a .zip archive.');
      return;
    }
    
    setIsParsing(true);
    setError(null);
    
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const filesMap: { [path: string]: VirtualFile } = {};
      const filePaths: string[] = [];
      const promises: Promise<void>[] = [];
      
      contents.forEach((relativePath, fileItem) => {
        // Skip directory records
        if (fileItem.dir) return;
        
        const promise = (async () => {
          const name = fileItem.name.split('/').pop() || fileItem.name;
          const mimeType = getMimeType(name);
          const isBinary = isBinaryFile(name, mimeType);
          
          // Read binary buffer
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
        throw new Error('This ZIP archive appears to be empty or contains no files.');
      }
      
      // Auto-resolve landing page path
      let entryFile = 'index.html';
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
      
      const newSiteId = `site-${Math.random().toString(36).substring(2, 8)}`;
      
      await registerWithServiceWorker(newSiteId, filesMap);
      const tree = buildFileTree(filePaths);
      
      setHostedSite({
        id: newSiteId,
        name: file.name.replace(/\.zip$/i, ''),
        files: filesMap,
        createdAt: Date.now()
      });
      
      setFileTreeRoot(tree);
      setActivePath(entryFile);
      setSelectedFilePath(entryFile);
      
    } catch (err: any) {
      console.error('[ZipHost] Extraction error:', err);
      setError(err.message || 'Failed to extract the website ZIP archive. Please ensure it is not corrupt.');
    } finally {
      setIsParsing(false);
    }
  };

  // Drag-and-drop triggers
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
      handleZipFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleZipFile(e.target.files[0]);
    }
  };

  // Launch Demo Portfolio Workspace
  const handleLoadDemo = async () => {
    setIsParsing(true);
    setError(null);
    
    try {
      const filesMap: { [path: string]: VirtualFile } = {};
      const filePaths: string[] = [];
      const encoder = new TextEncoder();
      
      Object.entries(sampleSiteFiles).forEach(([path, text]) => {
        const arrayBuffer = encoder.encode(text).buffer;
        const mimeType = getMimeType(path);
        
        filesMap[path] = {
          path,
          name: path,
          mimeType,
          content: arrayBuffer,
          textValue: text,
          size: arrayBuffer.byteLength,
          isBinary: false
        };
        
        filePaths.push(path);
      });
      
      const newSiteId = `demo-${Math.random().toString(36).substring(2, 8)}`;
      await registerWithServiceWorker(newSiteId, filesMap);
      const tree = buildFileTree(filePaths);
      
      setHostedSite({
        id: newSiteId,
        name: 'Interactive Demo Portfolio',
        files: filesMap,
        createdAt: Date.now()
      });
      
      setFileTreeRoot(tree);
      setActivePath('index.html');
      setSelectedFilePath('index.html');
      
    } catch (err: any) {
      console.error('[ZipHost] Demo loading failed:', err);
      setError('Failed to initialize demo workspace.');
    } finally {
      setIsParsing(false);
    }
  };

  // Live edit saving
  const handleSaveContent = (path: string, newText: string) => {
    if (!hostedSite) return;
    
    const encoder = new TextEncoder();
    const content = encoder.encode(newText).buffer;
    
    const updatedFiles = {
      ...hostedSite.files,
      [path]: {
        ...hostedSite.files[path],
        content,
        textValue: newText,
        size: content.byteLength
      }
    };
    
    const updatedSite: HostedSite = {
      ...hostedSite,
      files: updatedFiles
    };
    
    registerWithServiceWorker(hostedSite.id, updatedFiles)
      .then(() => {
        setHostedSite(updatedSite);
        // Force refresh preview if active
        if (path === activePath) {
          setActivePath(path);
        }
      })
      .catch((err) => {
        console.error('[ZipHost] Save error:', err);
        setError('Failed to apply source edits to the virtual hosting scope.');
      });
  };

  // File selection triggers
  const handleSelectFile = (path: string) => {
    setSelectedFilePath(path);
    // If the selected file is an HTML page, route the active preview to load it
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      setActivePath(path);
    }
  };

  const handleUnload = () => {
    if (hostedSite && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UNREGISTER_SITE',
        siteId: hostedSite.id
      });
    }
    setHostedSite(null);
    setFileTreeRoot(null);
    setSelectedFilePath(null);
    setActivePath('index.html');
    setError(null);
  };

  const getSelectedFileObject = (): VirtualFile | null => {
    if (!hostedSite || !selectedFilePath) return null;
    return hostedSite.files[selectedFilePath] || null;
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* Top Header Control Area */}
      <header className="flex-shrink-0 px-6 py-4 bg-slate-900/40 border-b border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Code2 className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-display text-slate-100 flex items-center gap-2">
              ZIP File Host <span className="text-xs bg-slate-800 text-slate-400 font-mono font-medium px-2 py-0.5 rounded border border-slate-700/50">v1.0</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Instant client-side static web sandboxing & code editing</p>
          </div>
        </div>

        {/* Engine Liveness Status */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isSWReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>Sandbox Server: {isSWReady ? 'ONLINE' : 'BOOTING'}</span>
          </div>

          {hostedSite && (
            <button
              onClick={handleUnload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg border border-slate-800 hover:border-red-900/30 text-xs font-medium transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Unload Site</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 overflow-hidden min-h-0 p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {!hostedSite ? (
            /* Upload Screen (Empty State) */
            <motion.div
              key="upload-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto w-full px-4"
            >
              {/* Alert Message Box if present */}
              {error && (
                <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Execution Warning</p>
                    <p className="mt-1 text-rose-400/90 leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              {/* Upload Dashed Container */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full p-12 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden group ${
                  isDragging
                    ? 'border-blue-500 bg-blue-950/20 shadow-2xl shadow-blue-500/5'
                    : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700/80 hover:bg-slate-900/15'
                }`}
              >
                {/* Visual Glow Layer */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".zip"
                  className="hidden"
                />

                {isParsing ? (
                  <div className="flex flex-col items-center py-6">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <h3 className="text-base font-semibold text-slate-200">Decompressing Archive...</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                      Reading static file buffers, organizing folders, and mounting local service cache.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-6 group-hover:scale-105 group-hover:border-slate-700/80 group-hover:text-blue-400 transition-all duration-300">
                      <FolderArchive className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-200 group-hover:text-slate-100 transition-colors">
                      Upload Static Website ZIP
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                      Drag & drop or browse to upload any zip file containing an <code className="text-slate-300">index.html</code> (along with styles, javascript, and folders).
                    </p>
                    <div className="mt-8 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-500/15 transition-all">
                      Select ZIP File
                    </div>
                  </div>
                )}
              </div>

              {/* Instant Try-out Launcher Card */}
              {!isParsing && (
                <div className="w-full mt-8 p-6 bg-slate-900/30 rounded-2xl border border-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h4 className="text-xs font-semibold text-slate-200">No ZIP file ready?</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Instantly spin up a multi-page interactive web portfolio workspace to experience the hosting engine.
                    </p>
                  </div>
                  <button
                    onClick={handleLoadDemo}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-200" />
                    <span>Launch Interactive Demo</span>
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            /* Active Code & Preview Workspace IDE */
            <motion.div
              key="ide-workspace"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0"
            >
              {/* Left Column: Explorer Tree Panel */}
              <div className="lg:col-span-3 flex flex-col bg-slate-950/40 rounded-xl border border-slate-900/80 overflow-hidden min-h-[250px] lg:min-h-0">
                <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-900/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderArchive className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-200 truncate font-mono">{hostedSite.name}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-1">
                  {fileTreeRoot && (
                    <FileTree
                      node={fileTreeRoot}
                      files={hostedSite.files}
                      selectedPath={selectedFilePath}
                      onSelectFile={handleSelectFile}
                    />
                  )}
                </div>

                <div className="p-3 bg-slate-900/20 border-t border-slate-900/60 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                  <span>Files: {Object.keys(hostedSite.files).length}</span>
                  <span>Size: {formatBytes((Object.values(hostedSite.files) as VirtualFile[]).reduce((sum: number, f: VirtualFile) => sum + f.size, 0))}</span>
                </div>
              </div>

              {/* Middle Column: Editor Panel */}
              <div className="lg:col-span-4 min-h-[350px] lg:min-h-0">
                <EditorPanel
                  file={getSelectedFileObject()}
                  onSaveContent={handleSaveContent}
                />
              </div>

              {/* Right Column: Preview Panel */}
              <div className="lg:col-span-5 min-h-[450px] lg:min-h-0">
                <PreviewPanel
                  siteId={hostedSite.id}
                  activePath={activePath}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
