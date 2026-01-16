import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppConfig, KnowledgeDocument, Message, ToastNotification, DEFAULT_MODEL } from '../types';
import { prepareContext } from '../utils/ragEngine';
import { generateStreamResponse } from '../services/geminiService';
import { db } from '../services/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

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

  // Data Management
  clearAllData: () => void;
  exportBackup: () => void;
  importBackup: () => Promise<void>;
}

const GeminiContext = createContext<GeminiContextProps | undefined>(undefined);

export const GeminiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- Estado: Documentos (Sincronizado con Firebase) ---
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);

  // --- Estado: Chat (Local por sesión) ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // --- Estado: Configuración (Local Storage - Preferencias del usuario) ---
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('gem_config');
      return saved ? JSON.parse(saved) : {
        systemInstructions: 'Eres el asistente IA de Noelia Supermercado. Tu objetivo es ayudar con información precisa. REGLA VISUAL: Siempre que listes precios o productos, utiliza Tablas Markdown para facilitar la lectura.',
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
    setTimeout(() => removeToast(id), 5000); // 5s para leer errores
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Efecto: Sincronización en Tiempo Real con Firebase ---
  useEffect(() => {
    // Escuchamos la colección 'knowledge_base'
    const q = query(collection(db, "knowledge_base"), orderBy("addedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const docs: KnowledgeDocument[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as KnowledgeDocument));
        
        setDocuments(docs);
      }, 
      (error) => {
        console.error("Error fetching documents:", error);
        
        if (error.code === 'permission-denied') {
             addToast('error', 'PERMISO DENEGADO: Configura las Reglas de Firestore a "allow read, write: if true;"');
        } else if (error.code === 'failed-precondition') {
             addToast('error', 'FALTA ÍNDICE: Revisa la consola para crear el índice de Firestore.');
        } else {
             addToast('error', `Error de Base de Datos: ${error.message}`);
        }
      }
    );

    return () => unsubscribe();
  }, [addToast]);

  // --- Persistencia Config Local ---
  useEffect(() => {
    localStorage.setItem('gem_config', JSON.stringify(config));
  }, [config]);


  const addDocument = async (title: string, content: string) => {
    try {
        // En lugar de guardar en local, guardamos en Firebase
        await addDoc(collection(db, "knowledge_base"), {
            title,
            content,
            addedAt: Date.now(),
            tokensEstimated: Math.ceil(content.length / 4)
        });
        addToast('success', `Documento "${title}" subido a la nube.`);
    } catch (e: any) {
        console.error(e);
        if (e.code === 'permission-denied') {
            addToast('error', 'NO PUEDES ESCRIBIR: Revisa las Reglas de Seguridad de Firestore.');
        } else {
            addToast('error', 'Error al subir el documento.');
        }
    }
  };

  const removeDocument = async (id: string) => {
    try {
        await deleteDoc(doc(db, "knowledge_base", id));
        addToast('info', 'Documento eliminado de la nube.');
    } catch (e: any) {
        console.error(e);
        addToast('error', 'Error al eliminar documento (Posible error de permisos).');
    }
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    addToast('success', 'Configuración actualizada.');
  };

  const clearAllData = async () => {
    if (confirm('¡ATENCIÓN! Esto intentará borrar documentos de la base de datos compartida. ¿Seguro?')) {
        // Nota: Borrar una colección entera desde el cliente no es recomendado en producción sin Cloud Functions,
        // pero para este prototipo iteraremos.
        documents.forEach(d => removeDocument(d.id));
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

    // 2. Preparar Contexto RAG (Usando los documentos sincronizados de Firebase)
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
      toasts, addToast, removeToast,
      clearAllData,
      exportBackup: () => alert("La base de datos está sincronizada en la nube."),
      importBackup: async () => alert("Usa la opción de Subir Archivo para agregar datos.")
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