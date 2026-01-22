
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppConfig, KnowledgeDocument, Message, ToastNotification, ChatSession, DEFAULT_MODEL, Theme, DEFAULT_CSV_URL } from '../types';
import { prepareContext } from '../utils/ragEngine';
import { generateStreamResponse } from '../services/geminiService';
import { STATIC_DOCUMENTS } from '../data/staticKnowledge'; 
import { fetchCsvKnowledge } from '../services/csvLoader';

interface GeminiContextProps {
  documents: KnowledgeDocument[];
  addDocument: (title: string, content: string) => void;
  removeDocument: (id: string) => void;
  refreshDynamicKnowledge: () => Promise<void>;
  isLoadingKnowledge: boolean;
  
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
  isTyping: boolean;
  
  sessions: ChatSession[];
  activeSessionId: string | null;
  createNewChat: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearHistory: () => void;

  config: AppConfig;
  updateConfig: (newConfig: Partial<AppConfig>) => void;
  
  theme: Theme;
  setTheme: (theme: Theme) => void;

  isAdminMode: boolean;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
  
  toasts: ToastNotification[];
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;

  clearAllData: () => void;
}

const GeminiContext = createContext<GeminiContextProps | undefined>(undefined);

export const GeminiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Documentos Locales (User Uploads)
  const [localDocuments, setLocalDocuments] = useState<KnowledgeDocument[]>(() => {
    try {
      const saved = localStorage.getItem('gem_local_docs');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 2. Documentos Dinámicos (CSV de Google Sheets)
  const [dynamicDoc, setDynamicDoc] = useState<KnowledgeDocument | null>(() => {
    try {
        const saved = localStorage.getItem('gem_dynamic_doc');
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // 3. Documentos Estáticos (Hardcoded) - Siempre presentes desde el código
  // No se usan estados ni fetching de Firebase para esto.

  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);

  // Configuración
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('gem_config');
      const parsed = saved ? JSON.parse(saved) : {};
      
      return {
        systemInstructions: parsed.systemInstructions || 'Eres el asistente IA de Noelia Supermercado. Tu objetivo es ayudar con información precisa basada en los documentos provistos. REGLA VISUAL: Siempre que listes precios o productos, no utilices Tablas Markdown.',
        model: parsed.model || DEFAULT_MODEL,
        thinkingBudget: parsed.thinkingBudget || 0,
        useSearchGrounding: parsed.useSearchGrounding || false,
        strictMode: parsed.strictMode !== undefined ? parsed.strictMode : true,
        // Usamos la URL guardada o el default hardcodeado
        publicCsvUrl: parsed.publicCsvUrl || DEFAULT_CSV_URL
      };
    } catch (e) {
      return {
        systemInstructions: 'Eres un asistente útil.',
        model: DEFAULT_MODEL,
        thinkingBudget: 0,
        useSearchGrounding: false,
        strictMode: true,
        publicCsvUrl: DEFAULT_CSV_URL
      };
    }
  });

  // Combinar todas las fuentes: Estáticos (Código) + Dinámico (CSV) + Locales (Uploads)
  const documents = [
      ...STATIC_DOCUMENTS, 
      ...(dynamicDoc ? [dynamicDoc] : []), 
      ...localDocuments
  ];

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('gem_theme') as Theme) || 'system'; } catch { return 'system'; }
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try { const saved = localStorage.getItem('gem_chat_history'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  // --- ACTIONS ---

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000); 
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch Dynamic Data from CSV
  const refreshDynamicKnowledge = async () => {
    if (!config.publicCsvUrl || config.publicCsvUrl.includes('TU_ID_AQUI')) {
        return; 
    }

    setIsLoadingKnowledge(true);
    try {
        const doc = await fetchCsvKnowledge(config.publicCsvUrl);
        if (doc) {
            setDynamicDoc(doc);
            localStorage.setItem('gem_dynamic_doc', JSON.stringify(doc));
            if (dynamicDoc) addToast('success', 'Precios actualizados.');
        } else {
            addToast('error', 'No se pudo leer el CSV.');
        }
    } catch (e) {
        console.error(e);
        addToast('error', 'Error de conexión al CSV.');
    } finally {
        setIsLoadingKnowledge(false);
    }
  };

  // Auto-refresh on mount if URL exists
  useEffect(() => {
    if (config.publicCsvUrl && !config.publicCsvUrl.includes('TU_ID_AQUI')) {
        refreshDynamicKnowledge();
    }
  }, []); 

  // --- PERSISTENCE & THEME EFFECTS ---
  
  useEffect(() => {
    const root = window.document.documentElement;
    localStorage.setItem('gem_theme', theme);
    const applyTheme = () => {
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    };
    applyTheme();
    if (theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', applyTheme);
        return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  useEffect(() => { localStorage.setItem('gem_chat_history', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem('gem_local_docs', JSON.stringify(localDocuments)); }, [localDocuments]);
  useEffect(() => { localStorage.setItem('gem_config', JSON.stringify(config)); }, [config]);

  // Session Logic
  useEffect(() => {
    if (messages.length === 0) return;
    if (activeSessionId) {
      setSessions(prev => prev.map(session => session.id === activeSessionId ? { ...session, messages, updatedAt: Date.now() } : session));
    } else {
      const newId = crypto.randomUUID();
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Nuevo Chat';
      const title = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + '...' : firstUserMsg;
      const newSession: ChatSession = { id: newId, title, messages, createdAt: Date.now(), updatedAt: Date.now() };
      setActiveSessionId(newId);
      setSessions(prev => [newSession, ...prev]);
    }
  }, [messages, activeSessionId]);

  const createNewChat = () => { setMessages([]); setActiveSessionId(null); setIsTyping(false); };
  const loadSession = (sessionId: string) => { const s = sessions.find(s => s.id === sessionId); if (s) { setMessages(s.messages); setActiveSessionId(s.id); } };
  const deleteSession = (sid: string) => { setSessions(prev => prev.filter(s => s.id !== sid)); if (activeSessionId === sid) createNewChat(); addToast('info', 'Chat eliminado.'); };
  const clearHistory = () => { if (confirm('¿Borrar historial?')) { setSessions([]); createNewChat(); addToast('success', 'Historial limpio.'); } };

  // Admin
  const loginAdmin = (pwd: string) => { if (pwd === 'admin123') { setIsAdminMode(true); addToast('success', 'Modo Admin'); return true; } addToast('error', 'Error'); return false; };
  const logoutAdmin = () => { setIsAdminMode(false); addToast('info', 'Admin cerrado'); };

  // Docs Management
  const addDocument = (title: string, content: string) => {
    const newDoc: KnowledgeDocument = { id: crypto.randomUUID(), title, content, addedAt: Date.now(), tokensEstimated: Math.ceil(content.length / 4), isSystem: false };
    setLocalDocuments(prev => [newDoc, ...prev]);
    addToast('success', 'Doc agregado.');
  };
  const removeDocument = (id: string) => {
      // Allow removing local docs only
      if (localDocuments.some(d => d.id === id)) {
          setLocalDocuments(prev => prev.filter(d => d.id !== id));
          addToast('info', 'Doc eliminado.');
      } else {
          addToast('error', 'No se pueden borrar documentos del sistema (CSV o Estáticos).');
      }
  };
  const updateConfig = (newConfig: Partial<AppConfig>) => { setConfig(prev => ({ ...prev, ...newConfig })); addToast('success', 'Config guardada.'); };
  const clearAllData = () => { if (confirm('¿Borrar docs locales?')) setLocalDocuments([]); };

  // RAG & Send
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const { contextString, usedDocIds } = prepareContext(content, documents, 100000, config.strictMode);
    
    const aiMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: aiMsgId, role: 'model', content: '', timestamp: Date.now(), isStreaming: true, usedDocuments: usedDocIds }]);

    try {
      await generateStreamResponse([], content, contextString, config, (text) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: text } : m));
      });
    } catch (e: any) {
      addToast('error', e.message);
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: 'Error generando respuesta.' } : m));
    } finally {
      setIsTyping(false);
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m));
    }
  };

  return (
    <GeminiContext.Provider value={{
      documents, addDocument, removeDocument, refreshDynamicKnowledge, isLoadingKnowledge,
      messages, sendMessage, isTyping,
      sessions, activeSessionId, createNewChat, loadSession, deleteSession, clearHistory,
      config, updateConfig, 
      theme, setTheme,
      isAdminMode, loginAdmin, logoutAdmin, toasts, addToast, removeToast, clearAllData
    }}>
      {children}
    </GeminiContext.Provider>
  );
};

export const useGemini = () => {
  const context = useContext(GeminiContext);
  if (!context) throw new Error('useGemini must be used within a GeminiProvider');
  return context;
};
