
import { KnowledgeDocument } from '../types';
import { STATIC_DOCUMENTS } from '../data/staticKnowledge';

// CONFIGURACIÓN: Reemplaza esta URL con la ruta "Raw" de tu archivo JSON en GitHub, Gist o tu servidor.
// Ejemplo de estructura del JSON esperado:
// [
//   { "id": "1", "title": "Precios", "content": "...", "addedAt": 123456, "tokensEstimated": 100, "isSystem": true }
// ]
const REMOTE_KNOWLEDGE_URL = 'https://gist.githubusercontent.com/usuario/id-gist/raw/noelia-db.json'; 

export const loadSystemKnowledge = async (): Promise<KnowledgeDocument[]> => {
  try {
    console.log(`📡 Intentando cargar base de conocimiento desde: ${REMOTE_KNOWLEDGE_URL}`);
    
    // Timeout de 3 segundos para no bloquear la app si la red es lenta
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(REMOTE_KNOWLEDGE_URL, { 
        signal: controller.signal,
        cache: 'no-store' // Evitar caché del navegador para obtener siempre la última versión
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    // Validación básica: Debe ser un array
    if (!Array.isArray(data)) {
        throw new Error('El formato del JSON remoto no es un array válido');
    }

    // Mapeo seguro para asegurar que tengan la flag isSystem
    const validDocs: KnowledgeDocument[] = data.map((doc: any) => ({
        id: doc.id || crypto.randomUUID(),
        title: doc.title || 'Documento Remoto Sin Título',
        content: doc.content || '',
        addedAt: doc.addedAt || Date.now(),
        tokensEstimated: doc.tokensEstimated || Math.ceil((doc.content?.length || 0) / 4),
        isSystem: true // Forzamos que sean de sistema
    }));

    console.log(`✅ Base de conocimiento remota cargada: ${validDocs.length} documentos.`);
    return validDocs;

  } catch (error) {
    console.warn("⚠️ Falló la carga remota, usando base de datos local (Fallback).", error);
    // Si falla, devolvemos los estáticos que ya tenemos en el código
    return STATIC_DOCUMENTS;
  }
};
