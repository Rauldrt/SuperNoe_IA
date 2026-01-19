
import React, { useState, useRef, useEffect } from 'react';
import { useGemini } from '../context/GeminiContext';
import { 
  Trash2, X, Wifi, Menu, Sparkles,
  Clock, Plus, MessageSquare, Lock, Unlock,
  Settings, Database, Cloud, FileSpreadsheet, FileText,
  ShieldCheck, ShieldAlert, Search, LogOut, KeyRound,
  Sun, Moon, Monitor, HardDrive, RefreshCw, Download, UploadCloud, Link, Save, Globe, FileJson, Copy, Table
} from 'lucide-react';
import { DEFAULT_MODEL, REASONING_MODEL, Theme, KnowledgeDocument } from '../types';

// Declare google global for GSI
declare const google: any;

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

// ----------------------------------------------------------------------
// CONTENIDO INTERNO REUTILIZABLE (Desktop & Mobile)
// ----------------------------------------------------------------------
const SidebarContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { 
      sessions, activeSessionId, loadSession, deleteSession, createNewChat, clearHistory,
      isAdminMode, loginAdmin, logoutAdmin,
      documents, addDocument, removeDocument, config, updateConfig, addToast,
      theme, setTheme, setSystemKnowledge
    } = useGemini();

    const [activeTab, setActiveTab] = useState<'history' | 'docs' | 'config'>('history');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Google Sheets State
    const [sheetsToken, setSheetsToken] = useState<string | null>(null);
    const [isSheetLoading, setIsSheetLoading] = useState(false);
    const [sheetUser, setSheetUser] = useState<string | null>(null);

    const handleNewChat = () => {
        createNewChat();
        if (window.innerWidth < 768 && onClose) onClose();
    }

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return 'Hace 7 días';
        return date.toLocaleDateString();
    };

    const handleAdminToggle = () => {
        if (isAdminMode) {
            logoutAdmin();
            setActiveTab('history');
        } else {
            // Open Custom Modal instead of native prompt
            setShowLoginModal(true);
            setPasswordInput('');
        }
    };

    const submitLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginAdmin(passwordInput)) {
            setShowLoginModal(false);
            setPasswordInput('');
            setActiveTab('config');
        }
    };

    const cycleTheme = () => {
        const modes: Theme[] = ['light', 'dark', 'system'];
        const nextIndex = (modes.indexOf(theme) + 1) % modes.length;
        setTheme(modes[nextIndex]);
        addToast('info', `Tema: ${modes[nextIndex] === 'system' ? 'Automático' : modes[nextIndex] === 'dark' ? 'Oscuro' : 'Claro'}`);
    };

    const getThemeIcon = () => {
        switch(theme) {
            case 'light': return <Sun size={14} />;
            case 'dark': return <Moon size={14} />;
            case 'system': return <Monitor size={14} />;
        }
    };

    // --- Local File Logic ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
    
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileNameLower = file.name.toLowerCase();
          try {
            const text = await file.text();
            addDocument(file.name, text);
          } catch (err) {
            addToast('error', `Error al leer el archivo: ${file.name}`);
          }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getFileIcon = (fileName: string) => {
        if (fileName.toLowerCase().endsWith('.csv') || fileName.includes('Precio')) return <FileSpreadsheet size={16} />;
        return <FileText size={16} />;
    };

    // --- GOOGLE SHEETS LOGIC (CMS) ---

    // 1. Authenticate with Google Sheets scope
    const handleSheetsAuth = () => {
        if (!config.googleSheets.clientId) {
            addToast('error', 'Falta Client ID en Configuración.');
            return;
        }

        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: config.googleSheets.clientId,
                scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email',
                callback: (response: any) => {
                    if (response.access_token) {
                        setSheetsToken(response.access_token);
                        addToast('success', 'Conectado a Google.');
                        // Get user email
                        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${response.access_token}` }
                        })
                        .then(res => res.json())
                        .then(data => setSheetUser(data.email))
                        .catch(() => setSheetUser('Usuario Google'));
                    }
                },
            });
            client.requestAccessToken();
        } catch (e) {
            addToast('error', 'Error al inicializar Google Auth.');
        }
    };

    // 2. Fetch and Sync Data
    const handleSheetSync = async () => {
        if (!sheetsToken) return handleSheetsAuth();
        if (!config.googleSheets.spreadsheetId) {
            addToast('error', 'Falta el ID de la Hoja de Cálculo.');
            return;
        }

        setIsSheetLoading(true);
        const spreadsheetId = config.googleSheets.spreadsheetId;

        try {
            // A. Fetch "Conocimiento" (Products, Prices, etc.)
            // Assumption: Tab name 'Conocimiento', Col A=Title, Col B=Content
            const knowledgeRes = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Conocimiento!A2:B`, 
                { headers: { Authorization: `Bearer ${sheetsToken}` } }
            );
            
            if (knowledgeRes.ok) {
                const data = await knowledgeRes.json();
                const rows = data.values || [];
                
                if (rows.length > 0) {
                    const newDocs: KnowledgeDocument[] = rows.map((row: string[], idx: number) => ({
                        id: `sheet-doc-${idx}`,
                        title: row[0] || 'Sin Título',
                        content: row[1] || '',
                        addedAt: Date.now(),
                        tokensEstimated: Math.ceil((row[1]?.length || 0) / 4),
                        isSystem: true
                    })).filter((d: KnowledgeDocument) => d.content.length > 0);

                    setSystemKnowledge(newDocs);
                    addToast('success', `Se sincronizaron ${newDocs.length} documentos.`);
                } else {
                    addToast('info', 'La pestaña "Conocimiento" está vacía o no existe.');
                }
            } else {
                console.warn('Error fetching Conocimiento tab', await knowledgeRes.text());
            }

            // B. Fetch "Configuracion" (App Settings)
            // Assumption: Tab name 'Configuracion', Col A=Key, Col B=Value
            const configRes = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Configuracion!A2:B`,
                { headers: { Authorization: `Bearer ${sheetsToken}` } }
            );

            if (configRes.ok) {
                const data = await configRes.json();
                const rows = data.values || [];
                const updates: any = {};
                let updatedCount = 0;

                rows.forEach((row: string[]) => {
                    const key = row[0]?.trim();
                    const val = row[1]?.trim();
                    if (!key || !val) return;

                    if (key === 'systemInstructions') updates.systemInstructions = val;
                    if (key === 'model') updates.model = val;
                    if (key === 'strictMode') updates.strictMode = val.toLowerCase() === 'true';
                    if (key === 'useSearchGrounding') updates.useSearchGrounding = val.toLowerCase() === 'true';
                    updatedCount++;
                });

                if (updatedCount > 0) {
                    updateConfig(updates);
                    addToast('success', `Configuración actualizada (${updatedCount} valores).`);
                }
            }

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Error de sincronización: ' + error.message);
        } finally {
            setIsSheetLoading(false);
        }
    };

    const handleDownloadJSON = () => {
        const jsonString = JSON.stringify(documents, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `knowledge-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('success', 'Backup descargado correctamente.');
    };

    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <div className="flex flex-col h-full w-full relative">
            
            {/* Visual Indicator for Admin Mode */}
            {isAdminMode && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 z-50"></div>
            )}

            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className={isAdminMode ? "text-amber-500" : "text-brand-500"} size={20} />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                    {isAdminMode ? "Admin Panel" : "Noelia AI"}
                    </h1>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-brand-500 transition-colors">
                    <X size={24} />
                    </button>
                )}
            </div>

            {/* Status Bar */}
            <div className={`px-6 py-2 flex items-center justify-between text-xs font-medium border-b border-gray-100 dark:border-white/5 ${isAdminMode ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400'}`}>
                <div className="flex items-center gap-2">
                    {isAdminMode ? <ShieldCheck size={12} /> : <Wifi size={12} />}
                    <span>{isAdminMode ? 'Superusuario' : 'Sincronizado'}</span>
                </div>
                {sheetsToken && (
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                        Sheets OK
                    </span>
                )}
            </div>

            {/* NEW CHAT BUTTON */}
            <div className="p-4">
                <button 
                    onClick={handleNewChat}
                    className="w-full btn-aurora flex items-center justify-center gap-2 py-3 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all transform hover:-translate-y-0.5 font-medium text-white"
                >
                    <Plus size={20} />
                    <span>Nuevo Chat</span>
                </button>
            </div>

            {/* ADMIN TABS (Only Visible if Admin Mode) */}
            {isAdminMode && (
                <div className="flex px-4 pb-2 gap-1 border-b border-gray-100 dark:border-white/10 shrink-0 animate-fade-in-down">
                    <button 
                    onClick={() => setActiveTab('history')}
                    title="Historial"
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all duration-300
                        ${activeTab === 'history' 
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 font-bold' 
                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}
                    `}
                    >
                    <Clock size={16} />
                    </button>
                    <button 
                    onClick={() => setActiveTab('docs')}
                    title="Documentos"
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all duration-300
                        ${activeTab === 'docs' 
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 font-bold' 
                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}
                    `}
                    >
                    <Database size={16} />
                    </button>
                    <button 
                    onClick={() => setActiveTab('config')}
                    title="Configuración"
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all duration-300
                        ${activeTab === 'config' 
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 font-bold' 
                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}
                    `}
                    >
                    <Settings size={16} />
                    </button>
                </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar mt-2 relative">
                
                {/* --- LOGIN MODAL OVERLAY --- */}
                {showLoginModal && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                        <div className="w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-menu-circular">
                            <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-4 flex justify-between items-center text-white">
                                <span className="text-sm font-bold flex items-center gap-2">
                                    <Lock size={14} /> Admin
                                </span>
                                <button onClick={() => setShowLoginModal(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                            <form onSubmit={submitLogin} className="p-4 space-y-3">
                                <div className="space-y-1">
                                    <div className="relative">
                                        <KeyRound size={14} className="absolute left-3 top-3 text-gray-400" />
                                        <input 
                                            type="password" 
                                            autoFocus
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                            placeholder="Contraseña"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 ring-amber-400 outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 pl-1">Prueba: <span className="font-mono text-amber-600 dark:text-amber-400">admin123</span></p>
                                </div>
                                <button 
                                    type="submit"
                                    className="w-full py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-orange-500/20 transition-all"
                                >
                                    Entrar
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- HISTORY VIEW --- */}
                {activeTab === 'history' && (
                    <>
                         <div className="flex justify-between items-center mb-2 px-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tu Historial</span>
                            {sortedSessions.length > 0 && (
                                <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-600 hover:underline">
                                    Borrar todo
                                </button>
                            )}
                        </div>

                        {sortedSessions.length === 0 ? (
                            <div className="text-center text-gray-400 py-12 flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                                    <Clock size={20} className="opacity-40" />
                                </div>
                                <span className="text-xs">No tienes chats guardados.</span>
                            </div>
                        ) : (
                            sortedSessions.map(session => (
                                <div 
                                    key={session.id}
                                    onClick={() => {
                                        loadSession(session.id);
                                        if (onClose) onClose();
                                    }}
                                    className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                                        ${activeSessionId === session.id 
                                            ? 'bg-white dark:bg-slate-800 border-brand-200 dark:border-brand-500/50 shadow-sm' 
                                            : 'border-transparent hover:bg-white dark:hover:bg-slate-800/50 hover:border-gray-100 dark:hover:border-white/5'
                                        }
                                    `}
                                >
                                    <div className={`p-2 rounded-full shrink-0 ${activeSessionId === session.id ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}>
                                        <MessageSquare size={16} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {session.title}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {formatDate(session.updatedAt)}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteSession(session.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                        title="Borrar chat"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </>
                )}

                {/* --- CONFIG TAB (Admin Only) --- */}
                {isAdminMode && activeTab === 'config' && (
                    <div className="space-y-6 animate-fade-in pt-2">
                        {/* Google Sheets Config */}
                        <div className="space-y-4 border-b border-gray-100 dark:border-white/5 pb-4">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                <Table size={12} /> Google Sheets CMS
                            </label>

                            <div className="space-y-2">
                                <input 
                                    type="text"
                                    value={config.googleSheets.clientId}
                                    onChange={(e) => updateConfig({ googleSheets: { ...config.googleSheets, clientId: e.target.value } })}
                                    placeholder="Client ID (Google Cloud)"
                                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs focus:ring-2 ring-brand-500 outline-none font-mono text-gray-600 dark:text-gray-300"
                                />
                                {/* Helper Copy Origin */}
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900/30 text-[10px] text-blue-800 dark:text-blue-200 break-all flex items-center justify-between">
                                    <span 
                                        className="font-mono cursor-pointer hover:underline truncate"
                                        onClick={() => { navigator.clipboard.writeText(window.location.origin); addToast('info', 'Origen copiado'); }}
                                    >
                                        {window.location.origin}
                                    </span>
                                    <Copy size={10} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <input 
                                    type="text"
                                    value={config.googleSheets.spreadsheetId}
                                    onChange={(e) => updateConfig({ googleSheets: { ...config.googleSheets, spreadsheetId: e.target.value } })}
                                    placeholder="Spreadsheet ID (Ej: 1A2b3C...)"
                                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs focus:ring-2 ring-brand-500 outline-none font-mono text-gray-600 dark:text-gray-300"
                                />
                                <p className="text-[9px] text-gray-400">
                                    Debe tener pestañas: <code>Conocimiento</code> y <code>Configuracion</code>.
                                </p>
                            </div>
                        </div>

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

                {/* --- DOCS TAB (Admin Only) --- */}
                {isAdminMode && activeTab === 'docs' && (
                    <div className="space-y-4 animate-fade-in pt-2">
                        {/* 1. Upload Section */}
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-slate-900 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 transition-all group"
                        >
                            <HardDrive size={32} className="text-gray-400 mb-2 group-hover:text-brand-500 transition-colors" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Cargar Documento Local</span>
                            <span className="text-xs text-gray-500 mt-1">Solo visible en este dispositivo</span>
                            <input type="file" multiple ref={fileInputRef} className="hidden" accept=".txt,.md,.csv,text/plain,text/csv" onChange={handleFileUpload} />
                        </div>

                        {/* 2. Documents List */}
                        <div className="space-y-2 max-h-[25vh] overflow-y-auto custom-scrollbar">
                            {documents.length === 0 && (
                                <div className="text-center text-gray-400 py-4 text-xs">
                                    La base de conocimientos está vacía.
                                </div>
                            )}
                            {documents.map(doc => (
                                <div key={doc.id} className={`flex items-center justify-between p-3 rounded-lg border ${doc.isSystem ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={doc.isSystem ? "text-amber-500" : "text-brand-500"}>{getFileIcon(doc.title)}</div>
                                        <div className="flex flex-col truncate">
                                            <span className="text-sm font-medium truncate flex items-center gap-1">
                                                {doc.title}
                                                {doc.isSystem && <Lock size={10} className="text-amber-500 opacity-60" />}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {doc.tokensEstimated} tokens • {doc.isSystem ? 'Sistema' : 'Local'}
                                            </span>
                                        </div>
                                    </div>
                                    {!doc.isSystem && (
                                        <button onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }} className="text-gray-400 hover:text-red-500">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {/* 3. Sync Cloud Section (Google Sheets) */}
                        <div className="border-t border-gray-100 dark:border-white/10 pt-4 mt-4 space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                                <Table size={12} /> Google Sheets Sync
                            </h4>
                            
                            {/* Auth Status */}
                            {!sheetsToken ? (
                                <button 
                                    onClick={handleSheetsAuth}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                                >
                                    <Table size={14} />
                                    Conectar Google Sheets
                                </button>
                            ) : (
                                <div className="space-y-3">
                                     <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg text-xs">
                                        <span className="flex items-center gap-2 text-green-700 dark:text-green-300">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg" alt="Sheets" className="w-3 h-3" />
                                            {sheetUser || 'Conectado'}
                                        </span>
                                        <button onClick={() => setSheetsToken(null)} className="text-[10px] text-green-500 hover:underline">Desconectar</button>
                                     </div>

                                     <button 
                                        onClick={handleSheetSync}
                                        disabled={isSheetLoading}
                                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-all shadow-lg shadow-brand-500/20"
                                        title="Leer Conocimiento y Configuración de Sheets"
                                     >
                                        {isSheetLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Sincronizar Todo
                                     </button>

                                     <p className="text-[9px] text-gray-400 text-center leading-relaxed">
                                         Lee pestañas: <b>Conocimiento</b> (Col A: Título, B: Contenido) y <b>Configuracion</b> (Col A: Clave, B: Valor).
                                     </p>
                                </div>
                            )}

                             {/* Manual Local Download (Fallback) */}
                             <button 
                                onClick={handleDownloadJSON}
                                className="w-full flex items-center justify-center gap-2 py-2 mt-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[10px] transition-colors"
                            >
                                <FileJson size={12} />
                                Exportar Local (.json)
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Footer with Theme Toggle and Admin Trigger */}
            <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center gap-2">
                <button 
                    onClick={cycleTheme}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-transparent text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-brand-500 dark:hover:text-brand-400 transition-all duration-300"
                    title={`Tema: ${theme}`}
                >
                    {getThemeIcon()}
                    <span className="text-[10px] font-medium capitalize">{theme}</span>
                </button>
                
                <button 
                    onClick={handleAdminToggle}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300
                        ${isAdminMode 
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 hover:bg-amber-200' 
                            : 'bg-transparent text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-500'}
                    `}
                    title={isAdminMode ? "Cerrar sesión" : "Acceso Administrativo"}
                >
                    {isAdminMode ? <LogOut size={12} /> : <Lock size={12} />}
                    <span className="text-[10px] font-medium">{isAdminMode ? 'Salir' : 'Admin'}</span>
                </button>
            </div>
        </div>
    );
};

// --- MAIN SIDEBAR COMPONENT (Responsive Wrapper) ---
const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar Container - UPDATED FOR FLOATING CARD LOOK */}
      <div 
        className={`
          fixed z-50 w-[22.5rem] transition-all duration-300 ease-spring
          /* Mobile Styles (Full height, flush) */
          inset-y-0 left-0 
          
          /* Desktop Styles (Floating Card) */
          md:top-4 md:bottom-4 md:left-4 md:h-[calc(100vh-2rem)]
          md:rounded-[2rem] md:border md:border-gray-200 md:dark:border-white/10
          md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] md:dark:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.7)]
          
          /* Background & Blur */
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
          
          /* State Transform */
          ${isOpen ? 'translate-x-0' : '-translate-x-[120%]'}
        `}
      >
        <div className="h-full w-full overflow-hidden md:rounded-[2rem]">
            <SidebarContent onClose={() => setIsOpen(false)} />
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed top-4 left-4 z-30 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-100 dark:border-white/10 md:hidden text-gray-500 hover:text-brand-500 transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <Menu size={24} />
      </button>
    </>
  );
};

export default Sidebar;
