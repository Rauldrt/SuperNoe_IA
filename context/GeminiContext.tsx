
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppConfig, KnowledgeDocument, Message, ToastNotification, ChatSession, DEFAULT_MODEL, Theme } from '../types';
import { prepareContext } from '../utils/ragEngine';
import { generateStreamResponse } from '../services/geminiService';
import { STATIC_DOCUMENTS } from '../data/staticKnowledge'; // Mantenemos import para inicialización rápida
import { loadSystemKnowledge } from '../services/knowledgeLoader';

interface GeminiContextProps {
  documents: KnowledgeDocument[];
  addDocument: (title: string, content: string) => void;
  removeDocument: (id: string) => void;
  refreshSystemKnowledge: () => Promise<void>; // Nueva función expuesta
  isLoadingKnowledge: boolean;
  
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
  isTyping: boolean;
  
  // History Management
  sessions: ChatSession[];
  activeSessionId: string | null;
  createNewChat: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearHistory: () => void;

  config: AppConfig;
  updateConfig: (newConfig: Partial<AppConfig>) => void;
  
  // Theme Management
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Admin Mode
  isAdminMode: boolean;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
  
  toasts: ToastNotification[];
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;

  // Data Management
  clearAllData: () => void;
}

const GeminiContext = createContext<GeminiContextProps | undefined>(undefined);

export const GeminiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- Estado: Documentos Locales (Subidos por usuario) ---
  const [localDocuments, setLocalDocuments] = useState<KnowledgeDocument[]>(() => {
    try {
      const saved = localStorage.getItem('gem_local_docs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // --- Estado: Documentos de Sistema (Remotos o Estáticos) ---
  // Inicializamos con STATIC_DOCUMENTS para tener datos inmediatos mientras carga lo remoto
  const [systemDocuments, setSystemDocuments] = useState<KnowledgeDocument[]>(STATIC_DOCUMENTS);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);

  // --- Efecto: Cargar Datos Remotos al Inicio ---
  useEffect(() => {
    refreshSystemKnowledge();
  }, []);

  const refreshSystemKnowledge = async () => {
    setIsLoadingKnowledge(true);
    try {
        const docs = await loadSystemKnowledge();
        setSystemDocuments(docs);
        // Opcional: Mostrar toast si cambia algo, pero mejor ser silencioso al inicio
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingKnowledge(false);
    }
  };

  // Los documentos totales son la suma de los del sistema (actualizados) y los locales
  const documents = [...systemDocuments, ...localDocuments];

  // --- Estado: Chat Actual ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // --- Estado: Admin Mode ---
  const [isAdminMode, setIsAdminMode] = useState(false);

  // --- Estado: Tema ---
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('gem_theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });

  // --- Estado: Historial de Sesiones (Local Storage) ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('gem_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // --- Estado: Configuración (Local Storage) ---
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('gem_config');
      return saved ? JSON.parse(saved) : {
        systemInstructions: 'Eres el asistente IA de Noelia Supermercado. Tu objetivo es ayudar con información precisa basada en los documentos provistos. REGLA VISUAL: Siempre que listes precios o productos, utiliza Tablas Markdown.',
        model: DEFAULT_MODEL,
        thinkingBudget: 0,
        useSearchGrounding: false,
        strictMode: true
      };
    } catch (e) {
      return {
        systemInstructions: 'Eres un asistente útil.',
        model: DEFAULT_MODEL,
        thinkingBudget: 0,
        useSearchGrounding: false,
        strictMode: true
      };
    }
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  
  // Actions
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000); 
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Theme Effect ---
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

  // --- Persistence: Chat History ---
  useEffect(() => {
    localStorage.setItem('gem_chat_history', JSON.stringify(sessions));
  }, [sessions]);

  // --- Auto-Save Current Chat Session ---
  useEffect(() => {
    if (messages.length === 0) return;

    if (activeSessionId) {
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? { ...session, messages, updatedAt: Date.now() }
          : session
      ));
    } else {
      const newId = crypto.randomUUID();
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Nuevo Chat';
      const title = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + '...' : firstUserMsg;
      
      const newSession: ChatSession = {
        id: newId,
        title,
        messages,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      setActiveSessionId(newId);
      setSessions(prev => [newSession, ...prev]);
    }
  }, [messages, activeSessionId]);

  // --- History Management Functions ---
  const createNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setIsTyping(false);
  };

  const loadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages);
      setActiveSessionId(session.id);
    }
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      createNewChat();
    }
    addToast('info', 'Chat eliminado.');
  };

  const clearHistory = () => {
    if (confirm('¿Estás seguro de borrar todo el historial de chats local?')) {
      setSessions([]);
      createNewChat();
      addToast('success', 'Historial limpio.');
    }
  };

  // --- Admin Logic ---
  const loginAdmin = (password: string) => {
    if (password === 'admin123') { // Simple hardcoded password for demo
        setIsAdminMode(true);
        addToast('success', 'Modo Administrador activado');
        return true;
    }
    addToast('error', 'Contraseña incorrecta');
    return false;
  };

  const logoutAdmin = () => {
    setIsAdminMode(false);
    addToast('info', 'Modo Administrador desactivado');
  };

  // --- Persistencia Documentos Locales ---
  useEffect(() => {
    localStorage.setItem('gem_local_docs', JSON.stringify(localDocuments));
  }, [localDocuments]);

  // --- Persistencia Config Local ---
  useEffect(() => {
    localStorage.setItem('gem_config', JSON.stringify(config));
  }, [config]);


  const addDocument = async (title: string, content: string) => {
    const newDoc: KnowledgeDocument = {
        id: crypto.randomUUID(),
        title,
        content,
        addedAt: Date.now(),
        tokensEstimated: Math.ceil(content.length / 4),
        isSystem: false
    };
    setLocalDocuments(prev => [newDoc, ...prev]);
    addToast('success', `Documento local "${title}" agregado.`);
  };

  const removeDocument = async (id: string) => {
    // Check if it's a system doc (ya sea estático o remoto)
    if (systemDocuments.some(d => d.id === id)) {
        addToast('error', 'No puedes eliminar documentos del sistema.');
        return;
    }
    setLocalDocuments(prev => prev.filter(d => d.id !== id));
    addToast('info', 'Documento local eliminado.');
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    addToast('success', 'Configuración actualizada.');
  };

  const clearAllData = async () => {
    if (confirm('Esto borrará todos tus documentos LOCALES personalizados. ¿Seguro?')) {
        setLocalDocuments([]);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // 1. Mensaje Usuario
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // 2. Preparar Contexto RAG (Usa documents que ya incluye SYSTEM + LOCAL)
    const { contextString, usedDocIds } = prepareContext(content, documents, 100000, config.strictMode);
    
    // 3. Placeholder Mensaje IA
    const aiMsgId = crypto.randomUUID();
    const initialAiMsg: Message = {
      id: aiMsgId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      usedDocuments: usedDocIds
    };
    setMessages(prev => [...prev, initialAiMsg]);

    try {
      await generateStreamResponse(
        [], 
        content,
        contextString,
        config,
        (streamedText) => {
          setMessages(prev => prev.map(m => 
            m.id === aiMsgId ? { ...m, content: streamedText } : m
          ));
        }
      );
    } catch (error: any) {
      addToast('error', `Error: ${error.message || 'Error desconocido'}`);
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId ? { ...m, content: 'Hubo un error al generar la respuesta.' } : m
      ));
    } finally {
      setIsTyping(false);
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId ? { ...m, isStreaming: false } : m
      ));
    }
  };

  return (
    <GeminiContext.Provider value={{
      documents, addDocument, removeDocument, refreshSystemKnowledge, isLoadingKnowledge,
      messages, sendMessage, isTyping,
      sessions, activeSessionId, createNewChat, loadSession, deleteSession, clearHistory,
      config, updateConfig,
      theme, setTheme,
      isAdminMode, loginAdmin, logoutAdmin,
      toasts, addToast, removeToast,
      clearAllData,
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
