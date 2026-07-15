/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Save, 
  AlertCircle, 
  FileText, 
  Check, 
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Undo2
} from 'lucide-react';
import { VirtualFile } from '../types';
import { formatBytes } from '../utils';

interface EditorPanelProps {
  file: VirtualFile | null;
  onSaveContent: (path: string, newText: string) => void;
  projectContext?: { [path: string]: string };
  isBackendOnline?: boolean | null;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ 
  file, 
  onSaveContent,
  projectContext = {},
  isBackendOnline = null
}) => {
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // AI Copilot state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiWorking, setIsAiWorking] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Synchronize state when file change
  useEffect(() => {
    if (!file) return;

    if (file.isBinary) {
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
      const text = file.textValue || '';
      setCode(text);
      setOriginalCode(text);
      setIsSaved(true);
      setImageUrl(null);
      setAiError(null);
      setAiPrompt('');
    }
  }, [file]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    setIsSaved(false);
  };

  const handleSave = () => {
    if (!file) return;
    onSaveContent(file.path, code);
    setOriginalCode(code);
    setIsSaved(true);
  };

  const handleUndoAi = () => {
    setCode(originalCode);
    setIsSaved(originalCode === (file?.textValue || ''));
  };

  // Trigger Gemini AI Code Assistance
  const handleAiEdit = async () => {
    if (!file || !aiPrompt.trim()) return;
    
    setIsAiWorking(true);
    setAiError(null);
    
    try {
      if (isBackendOnline === false) {
        throw new Error("This hosted environment is in Static-Only Mode. Gemini AI Code Assist is offline. Run locally or deploy to a container (Cloud Run) to use AI Co-Writer!");
      }

      const res = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          filePath: file.path,
          fileContent: code,
          projectContext
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("Invalid response from server. The backend API is offline or hosted on a static-only provider (like Netlify) without the Express backend server.");
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to edit code.');
      }

      const data = await res.json();
      if (data.code !== undefined) {
        setCode(data.code);
        setIsSaved(false);
        setAiPrompt('');
      } else {
        throw new Error('AI didn\'t return any updated code.');
      }
    } catch (err: any) {
      console.error('[Editor AI Error]:', err);
      setAiError(err.message || 'Failed to call Gemini AI.');
    } finally {
      setIsAiWorking(false);
    }
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
      <div className="flex-1 overflow-auto min-h-0 bg-slate-950/70 relative flex flex-col">
        {file.isBinary ? (
          /* Binary file renderer (e.g. Image Preview) */
          <div className="flex flex-col items-center justify-center h-full p-6 bg-slate-950">
            {imageUrl ? (
              <div className="flex flex-col items-center max-w-full">
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
          /* Text/Code Editor and Inline AI Assistant */
          <div className="relative flex-1 flex flex-col font-mono text-xs min-h-0">
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

            {/* AI Copilot Panel */}
            <div className="p-3 bg-slate-900/60 border-t border-slate-900/80 flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-400">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>GEMINI CO-WRITER (PRO MAX)</span>
                </div>
                {code !== originalCode && (
                  <button 
                    onClick={handleUndoAi}
                    className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 font-sans cursor-pointer"
                    title="Revert to pre-AI state"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Undo AI edits</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isBackendOnline === false ? "AI Code Assist is offline (Static Mode)" : "Ask Gemini to edit code (e.g. 'add a beautiful responsive feedback form')"}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isAiWorking && handleAiEdit()}
                  className="flex-1 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/50 transition-all font-sans disabled:opacity-40"
                  disabled={isAiWorking || isBackendOnline === false}
                />
                <button
                  onClick={handleAiEdit}
                  disabled={isAiWorking || !aiPrompt.trim() || isBackendOnline === false}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40"
                >
                  {isAiWorking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isAiWorking ? 'Coding...' : 'Edit'}</span>
                </button>
              </div>

              {aiError && (
                <p className="text-[10px] text-rose-400 flex items-center gap-1 font-sans">
                  <AlertCircle className="w-3 h-3" />
                  <span>{aiError}</span>
                </p>
              )}
            </div>
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
