/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCw, 
  Monitor, 
  Tablet, 
  Smartphone, 
  ExternalLink, 
  FileCheck2,
  Globe
} from 'lucide-react';

interface PreviewPanelProps {
  siteId: string | null;
  activePath: string; // Current simulated preview file path, e.g. "index.html"
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ siteId, activePath }) => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reload iframe by incrementing key
  const handleReload = () => {
    setIframeKey(prev => prev + 1);
  };

  const getSimulatedUrl = () => {
    if (!siteId) return '';
    return `/hosted/${siteId}/${activePath}`;
  };

  const getViewportWidthClass = () => {
    switch (viewportMode) {
      case 'mobile':
        return 'w-[375px] h-[667px] border-x border-y border-slate-800 rounded-3xl shadow-2xl';
      case 'tablet':
        return 'w-[768px] h-[900px] border-x border-y border-slate-800 rounded-2xl shadow-2xl';
      case 'desktop':
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div id="preview-panel-root" className="flex flex-col h-full bg-slate-950/40 rounded-xl border border-slate-900/80 overflow-hidden shadow-2xl">
      {/* Address / Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-900/80">
        {/* URL Mock Address Bar */}
        <div className="flex-1 flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 w-full">
          <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="font-mono text-xs text-slate-400 select-all truncate">
            {siteId ? `${window.location.origin}/hosted/${siteId}/${activePath}` : 'https://ziphost.local/waiting-for-zip'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-4 flex-shrink-0">
          {/* Viewport resizing toggles */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-slate-400">
            <button
              onClick={() => setViewportMode('desktop')}
              className={`p-1.5 rounded-md transition-all ${viewportMode === 'desktop' ? 'bg-slate-800 text-blue-400' : 'hover:text-slate-200'}`}
              title="Desktop Viewport"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewportMode('tablet')}
              className={`p-1.5 rounded-md transition-all ${viewportMode === 'tablet' ? 'bg-slate-800 text-blue-400' : 'hover:text-slate-200'}`}
              title="Tablet Viewport"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewportMode('mobile')}
              className={`p-1.5 rounded-md transition-all ${viewportMode === 'mobile' ? 'bg-slate-800 text-blue-400' : 'hover:text-slate-200'}`}
              title="Mobile Viewport"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReload}
              disabled={!siteId}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Refresh Preview"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            
            {siteId && (
              <a
                href={getSimulatedUrl()}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1 text-xs font-medium transition-all duration-150 hover:shadow-lg hover:shadow-blue-500/10 px-2.5 py-1.5"
                title="Launch fully in new tab"
              >
                <span className="hidden sm:inline">Open Live</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Frame Sandbox Canvas */}
      <div className="flex-1 bg-slate-950/60 p-4 flex justify-center items-center overflow-auto relative">
        {siteId ? (
          <div className={`transition-all duration-300 flex items-center justify-center bg-transparent ${getViewportWidthClass()}`}>
            <iframe
              id="preview-iframe"
              key={iframeKey}
              ref={iframeRef}
              src={getSimulatedUrl()}
              className="w-full h-full bg-white rounded-sm border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          /* Empty Preview State */
          <div id="preview-empty-state" className="flex flex-col items-center justify-center text-center p-8 text-slate-500 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-slate-900/60 flex items-center justify-center border border-slate-800/80 mb-4 animate-bounce">
              <FileCheck2 className="w-8 h-8 text-blue-500/80" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">Live Host Preview Canvas</h4>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Once you upload or drag a static ZIP file, the live iframe preview will serve your index.html here with responsive support.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
