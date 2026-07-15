/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  Image, 
  File as FileIcon, 
  ChevronRight, 
  ChevronDown 
} from 'lucide-react';
import { FileTreeNode, VirtualFile } from '../types';
import { formatBytes } from '../utils';

interface FileTreeProps {
  node: FileTreeNode;
  files: { [path: string]: VirtualFile };
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  node, 
  files, 
  selectedPath, 
  onSelectFile 
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const getFileIcon = (path: string) => {
    const file = files[path];
    if (!file) return <FileIcon className="w-4 h-4 text-slate-400" />;
    
    if (file.mimeType.startsWith('image/')) {
      return <Image className="w-4 h-4 text-emerald-400" />;
    }
    
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
      case 'htm':
        return <FileCode className="w-4 h-4 text-orange-400" />;
      case 'css':
        return <FileCode className="w-4 h-4 text-sky-400" />;
      case 'js':
      case 'mjs':
      case 'ts':
        return <FileCode className="w-4 h-4 text-yellow-400" />;
      case 'json':
        return <FileCode className="w-4 h-4 text-indigo-400" />;
      case 'md':
      case 'txt':
        return <FileText className="w-4 h-4 text-slate-300" />;
      default:
        return <FileIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  if (node.isDirectory) {
    // If it is the root node, we don't want to show the folder wrapper itself
    if (node.path === "") {
      return (
        <div id="file-tree-container" className="space-y-1">
          {node.children?.map(child => (
            <FileTree 
              key={child.path} 
              node={child} 
              files={files} 
              selectedPath={selectedPath} 
              onSelectFile={onSelectFile} 
            />
          ))}
        </div>
      );
    }

    return (
      <div id={`folder-${node.path}`} className="select-none">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 w-full py-1 px-1.5 rounded-md hover:bg-slate-800/50 text-left text-xs font-medium text-slate-300 transition-colors duration-150 group"
        >
          <span className="text-slate-500 group-hover:text-slate-300">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span className="text-amber-400/85">
            {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        
        {isExpanded && node.children && (
          <div className="pl-4 ml-2 border-l border-slate-800/80 mt-0.5 space-y-0.5">
            {node.children.map(child => (
              <FileTree 
                key={child.path} 
                node={child} 
                files={files} 
                selectedPath={selectedPath} 
                onSelectFile={onSelectFile} 
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File rendering
  const isSelected = selectedPath === node.path;
  const fileDetails = files[node.path];

  return (
    <button
      id={`file-${node.path.replace(/\//g, '-')}`}
      onClick={() => onSelectFile(node.path)}
      className={`flex items-center justify-between w-full py-1 px-2 rounded-md text-left text-xs transition-all duration-150 group ${
        isSelected 
          ? 'bg-blue-600/25 text-blue-200 border-l-2 border-blue-500 pl-1.5' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        {getFileIcon(node.path)}
        <span className="truncate">{node.name}</span>
      </div>
      {fileDetails && (
        <span className="font-mono text-[9px] text-slate-500 group-hover:text-slate-400 hidden sm:inline ml-2">
          {formatBytes(fileDetails.size)}
        </span>
      )}
    </button>
  );
};
