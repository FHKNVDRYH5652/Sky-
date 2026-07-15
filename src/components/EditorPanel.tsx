/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, FileText, Check, Image as ImageIcon } from 'lucide-react';
import { VirtualFile } from '../types';
import { formatBytes } from '../utils';

interface EditorPanelProps {
  file: VirtualFile | null;
  onSaveContent: (path: string, newText: string) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ file, onSaveContent }) => {
  const [code, setCode] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Synchronize state when file change
  useEffect(() => {
    if (!file) return;

    if (file.isBinary) {
      // Create Object URL for image preview if applicable
      if (file.mimeType.startsWith('image/')) {
        const blob = new Blob([file.content], { type: file.mimeType });
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      }
      setImageUrl(null);
    } else {
      // Textual file
      const text = file.textValue || '';
      setCode(text);
      setIsSaved(true);
      setImageUrl(null);
    }
  }, [file]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    setIsSaved(false);
  };

  const handleSave = () => {
    if (!file) return;
    onSaveContent(file.path, code);
    setIsSaved(true);
  };

  if (!file) {
    return (
      <div id="editor-empty-state" className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-950/20 rounded-xl border border-slate-900/60 p-8 text-center">
        <FileText className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
        <p className="text-sm font-medium text-slate-400">No File Selected</p>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Select any file from the file explorer sidebar to edit its code or preview its content.
        </p>
      </div>
    );
  }

  return (
    <div id="editor-panel-root" className="flex flex-col h-full bg-slate-950/40 rounded-xl border border-slate-900/80 overflow-hidden shadow-2xl">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/60 border-b border-slate-900/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs text-slate-500 select-none bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            {file.isBinary ? 'BINARY' : 'SOURCE'}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-slate-200 truncate font-mono">{file.name}</h3>
            <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5">{file.path}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!file.isBinary && (
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                isSaved 
                  ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/30' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer hover:shadow-lg hover:shadow-blue-500/10'
              }`}
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {isSaved ? 'Saved' : 'Save & Compile'}
            </button>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto min-h-0 bg-slate-950/70 relative">
        {file.isBinary ? (
          /* Binary file renderer (e.g. Image Preview) */
          <div className="flex flex-col items-center justify-center h-full p-6 bg-slate-950">
            {imageUrl ? (
              <div className="flex flex-col items-center max-w-full">
                {/* Chequered transparency background for images */}
                <div 
                  className="rounded-lg p-2 border border-slate-800 shadow-xl max-w-full"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, #182235 25%, transparent 25%), linear-gradient(-45deg, #182235 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #182235 75%), linear-gradient(-45deg, transparent 75%, #182235 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                >
                  <img 
                    src={imageUrl} 
                    alt={file.name} 
                    referrerPolicy="no-referrer"
                    className="max-h-[320px] object-contain rounded-md"
                  />
                </div>
                <div className="mt-4 font-mono text-center">
                  <p className="text-xs text-slate-300 font-medium">{file.name}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{file.mimeType} • {formatBytes(file.size)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                <ImageIcon className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-400">Binary Preview Unavailable</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  MIME: {file.mimeType} ({formatBytes(file.size)})
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Text/Code Editor */
          <div className="relative h-full flex flex-col font-mono text-xs">
            {/* Warning indicator if unsaved */}
            {!isSaved && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] rounded-full animate-pulse shadow-sm backdrop-blur-md">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Unsaved changes</span>
              </div>
            )}
            
            <textarea
              id="editor-textarea"
              value={code}
              onChange={handleTextChange}
              spellCheck={false}
              className="w-full flex-1 p-5 outline-none bg-transparent text-slate-300 resize-none font-mono text-xs leading-relaxed focus:ring-0 focus:border-none focus:outline-none"
              style={{ tabSize: 2 }}
            />
          </div>
        )}
      </div>

      {/* Editor Status Footer */}
      <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-900/80 flex justify-between items-center text-[10px] font-mono text-slate-500">
        <div>MIME: <span className="text-slate-400">{file.mimeType}</span></div>
        <div>Size: <span className="text-slate-400">{formatBytes(file.size)}</span></div>
      </div>
    </div>
  );
};
