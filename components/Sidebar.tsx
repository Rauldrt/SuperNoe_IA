import React, { useState, useRef } from 'react';
import { useGemini } from '../context/GeminiContext';
import { 
  Settings, Database, Upload, Trash2, FileText, 
  Search, X, FileSpreadsheet,
  ShieldCheck, ShieldAlert, Menu, Sparkles, Cloud, Wifi
} from 'lucide-react';
import { REASONING_MODEL, DEFAULT_MODEL } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

// ----------------------------------------------------------------------
// CONTENIDO INTERNO REUTILIZABLE (Desktop & Mobile)
// ----------------------------------------------------------------------
const SidebarContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { 
      documents, addDocument, removeDocument, 
      config, updateConfig, addToast
    } = useGemini();
    
    const [activeTab, setActiveTab] = useState<'docs' | 'config'>('config');
    const fileInputRef = useRef<HTMLInputElement>(null);
  
    const processCSVToMarkdown = (csvText: string): string => {
      const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return csvText;
      const headers = lines[0].split(',').map(h => h.trim());
      const separator = headers.map(() => '---');
      let markdownTable = `| ${headers.join(' | ')} |\n| ${separator.join(' | ')} |`;
      for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',').map(c => c.trim());
          while (cells.length < headers.length) cells.push(''); 
          markdownTable += `\n| ${cells.join(' | ')} |`;
      }
      return markdownTable;
    };
  
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
  
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNameLower = file.name.toLowerCase();
        try {
          let text = await file.text();
          if (fileNameLower.endsWith('.csv') || file.type === 'text/csv') {
             text = processCSVToMarkdown(text);
          }
          addDocument(file.name, text);
        } catch (err) {
          addToast('error', `Error al leer el archivo: ${file.name}`);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
  
    const getFileIcon = (fileName: string) => {
      if (fileName.endsWith('.csv')) return <FileSpreadsheet size={16} />;
      return <FileText size={16} />;
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-brand-500" size={20} />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-brand-500 to-rose-500 bg-clip-text text-transparent">
                    Noelia AI
                    </h1>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-brand-500 transition-colors">
                    <X size={24} />
                    </button>
                )}
            </div>

            {/* Status Bar */}
            <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Wifi size={12} />
                <span>Conectado a Nube Compartida</span>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-2 border-b border-gray-100 dark:border-white/10 shrink-0">
                <button 
                onClick={() => setActiveTab('config')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-all duration-300
                    ${activeTab === 'config' 
                    ? 'bg-brand-50 dark:bg-white/10 text-brand-600 dark:text-white font-medium shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'}
                `}
                >
                <Settings size={16} /> Config
                </button>
                <button 
                onClick={() => setActiveTab('docs')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-all duration-300
                    ${activeTab === 'docs' 
                    ? 'bg-brand-50 dark:bg-white/10 text-brand-600 dark:text-white font-medium shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'}
                `}
                >
                <Database size={16} /> Knowledge
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {activeTab === 'config' && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* RAG Strategy */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estrategia</label>
                            <div 
                                onClick={() => updateConfig({ strictMode: !config.strictMode })}
                                className={`aurora-container rounded-lg cursor-pointer transition-all ${config.strictMode ? 'opacity-100' : 'opacity-90'}`}
                            >
                                <div className={`relative z-10 flex items-center gap-3 p-3 rounded-lg border transition-colors ${config.strictMode ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-500/30' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10'}`}>
                                    <div className={`p-2 rounded-full ${config.strictMode ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}>
                                        {config.strictMode ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className={`text-sm font-bold ${config.strictMode ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {config.strictMode ? 'Estricto' : 'Híbrido'}
                                        </span>
                                    </div>
                                    <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-300 ${config.strictMode ? 'bg-brand-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${config.strictMode ? 'translate-x-3' : ''}`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Model */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Modelo</label>
                            <select 
                                value={config.model}
                                onChange={(e) => updateConfig({ model: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-brand-500 outline-none"
                            >
                                <option value={DEFAULT_MODEL}>Gemini 3 Flash</option>
                                <option value={REASONING_MODEL}>Gemini 3 Pro</option>
                            </select>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Prompt del Sistema</label>
                            <textarea 
                                value={config.systemInstructions}
                                onChange={(e) => updateConfig({ systemInstructions: e.target.value })}
                                className="w-full h-24 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-brand-500 outline-none resize-none"
                                placeholder="Personalidad..."
                            />
                        </div>

                        {/* Search Tool */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <Search size={16} className="text-brand-500" />
                                <span className="text-sm">Google Search</span>
                            </div>
                            <input 
                                type="checkbox"
                                checked={config.useSearchGrounding}
                                onChange={(e) => updateConfig({ useSearchGrounding: e.target.checked })}
                                className="accent-brand-500 w-4 h-4"
                                disabled={config.strictMode} 
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="space-y-4 animate-fade-in">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-slate-900 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 transition-all group"
                        >
                            <Cloud size={32} className="text-gray-400 mb-2 group-hover:text-brand-500 transition-colors" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Subir a la Nube</span>
                            <span className="text-xs text-gray-500 mt-1">Todos los usuarios verán esto</span>
                            <input type="file" multiple ref={fileInputRef} className="hidden" accept=".txt,.md,.csv,text/plain,text/csv" onChange={handleFileUpload} />
                        </div>

                        {documents.length === 0 && (
                          <div className="text-center text-gray-400 py-4 text-xs">
                             La base de conocimientos compartida está vacía.
                          </div>
                        )}

                        <div className="space-y-2">
                            {documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="text-brand-500">{getFileIcon(doc.title)}</div>
                                        <div className="flex flex-col truncate">
                                            <span className="text-sm font-medium truncate">{doc.title}</span>
                                            <span className="text-[10px] text-gray-400">{doc.tokensEstimated} tokens • Nube</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }} className="text-gray-400 hover:text-red-500">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// MAIN COMPONENT (Mobile Transform + Desktop Sidebar)
// ----------------------------------------------------------------------

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  return (
    <>
      {/* 
        ========================================
        MOBILE: CONTAINER TRANSFORM (FAB -> MODAL)
        ========================================
      */}
      <div 
        onClick={() => !isOpen && setIsOpen(true)}
        className={`
            md:hidden fixed z-50 
            transition-all duration-500 ease-emphasis
            shadow-2xl overflow-hidden
            ${isOpen 
                ? 'inset-2 rounded-[28px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10' 
                : 'bottom-6 right-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-rose-600 cursor-pointer shadow-[0_8px_20px_rgba(236,72,153,0.4)]'
            }
        `}
      >
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-100'}`}>
            <Menu className="text-white" strokeWidth={2.5} size={24} />
        </div>
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}`}>
             <SidebarContent onClose={() => setIsOpen(false)} />
        </div>
      </div>

      {/* 
        ========================================
        DESKTOP: FIXED SIDEBAR (Standard)
        ========================================
      */}
      <aside 
        className={`
          hidden md:flex flex-col
          fixed inset-y-0 left-0 z-50 w-80 
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl 
          border-r border-gray-200 dark:border-white/10 
          shadow-2xl transition-transform duration-500 ease-spring
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
         <SidebarContent /> 
      </aside>
    </>
  );
};

export default Sidebar;