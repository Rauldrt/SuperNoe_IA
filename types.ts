export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  addedAt: number;
  tokensEstimated: number; // Estimación simple: caracteres / 4
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  usedDocuments?: string[]; // IDs de documentos usados para esta respuesta
}

export interface AppConfig {
  systemInstructions: string;
  model: string;
  thinkingBudget: number; // 0 para desactivar
  useSearchGrounding: boolean;
  strictMode: boolean; // TRUE: Solo usa documentos. FALSE: Usa conocimiento general si falta info.
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// Model Constants
export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const REASONING_MODEL = 'gemini-3-pro-preview';