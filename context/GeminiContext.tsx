import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppConfig, KnowledgeDocument, Message, ToastNotification, DEFAULT_MODEL, REASONING_MODEL } from '../types';
import { prepareContext } from '../utils/ragEngine';
import { generateStreamResponse } from '../services/geminiService';

interface GeminiContextProps {
  documents: KnowledgeDocument[];
  addDocument: (title: string, content: string) => void;
  removeDocument: (id: string) => void;
  
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
  isTyping: boolean;
  
  config: AppConfig;
  updateConfig: (newConfig: Partial<AppConfig>) => void;
  
  toasts: ToastNotification[];
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
}

const GeminiContext = createContext<GeminiContextProps | undefined>(undefined);

export const GeminiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- Estado: Documentos ---
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(() => {
    const saved = localStorage.getItem('gem_documents');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Estado: Chat ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // --- Estado: Configuración ---
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('gem_config');
    return saved ? JSON.parse(saved) : {
      systemInstructions: 'Eres el asistente IA de Noelia Supermercado. Tu objetivo es ayudar con información precisa. REGLA VISUAL: Siempre que listes precios o productos, utiliza Tablas Markdown para facilitar la lectura.',
      model: DEFAULT_MODEL,
      thinkingBudget: 0,
      useSearchGrounding: false,
      strictMode: true // Por defecto: Prioridad absoluta a la base de conocimiento
    };
  });

  // --- Estado: UI ---
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Persistencia
  useEffect(() => {
    localStorage.setItem('gem_documents', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem('gem_config', JSON.stringify(config));
  }, [config]);

  // Actions
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addDocument = (title: string, content: string) => {
    const newDoc: KnowledgeDocument = {
      id: crypto.randomUUID(),
      title,
      content,
      addedAt: Date.now(),
      tokensEstimated: Math.ceil(content.length / 4)
    };
    setDocuments(prev => [newDoc, ...prev]);
    addToast('success', `Documento "${title}" añadido.`);
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    addToast('info', 'Documento eliminado.');
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    addToast('success', 'Configuración actualizada.');
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

    // 2. Preparar Contexto RAG con la configuración actual
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
      // 4. Llamada al Servicio
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
      documents, addDocument, removeDocument,
      messages, sendMessage, isTyping,
      config, updateConfig,
      toasts, addToast, removeToast
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