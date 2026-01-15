import { KnowledgeDocument } from '../types';

/**
 * Motor RAG del lado del cliente.
 * Mejorado para soportar "Context Stuffing" (enviar todo si cabe) y modos estrictos.
 */
export const prepareContext = (
  query: string,
  documents: KnowledgeDocument[],
  maxContextTokens: number = 30000, // Gemini soporta mucho contexto, seamos generosos
  strictMode: boolean = true
): { contextString: string; usedDocIds: string[] } => {
  
  if (documents.length === 0) {
    return { contextString: '', usedDocIds: [] };
  }

  // 1. Tokenización simple
  const queryTerms = query.toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);

  // 2. Puntuar documentos
  const scoredDocs = documents.map(doc => {
    let score = 0;
    const docTextLower = doc.content.toLowerCase();
    
    // Coincidencia exacta
    queryTerms.forEach(term => {
      if (docTextLower.includes(term)) score += 1;
    });

    // Bonus título
    queryTerms.forEach(term => {
      if (doc.title.toLowerCase().includes(term)) score += 3;
    });

    return { ...doc, score };
  });

  // 3. Estrategia de Selección:
  // Si no hay documentos relevantes por búsqueda de palabras clave,
  // PERO el total de tokens de TODOS los documentos es bajo (ej. < 30k),
  // enviamos TODOS los documentos. Esto es "Context Stuffing" y soluciona el problema de "no encontré nada".
  
  const totalTokensAllDocs = documents.reduce((acc, doc) => acc + doc.tokensEstimated, 0);
  let docsToProcess = [];

  const hasRelevantMatches = scoredDocs.some(d => d.score > 0);

  if (!hasRelevantMatches && totalTokensAllDocs < maxContextTokens) {
    // Fallback Inteligente: Enviar todo porque cabe.
    docsToProcess = [...documents]; 
  } else {
    // Filtrar por relevancia y ordenar
    docsToProcess = scoredDocs
        .filter(doc => doc.score > 0) // Si no cabe todo, filtramos estrictamente
        .sort((a, b) => b.score - a.score);
        
    // Si aún así está vacío y hay espacio, meter los más recientes
    if (docsToProcess.length === 0) {
        docsToProcess = [...documents].sort((a,b) => b.addedAt - a.addedAt).slice(0, 3);
    }
  }

  // 4. Construir String
  let currentTokens = 0;
  let contextParts: string[] = [];
  const usedDocIds: string[] = [];

  for (const doc of docsToProcess) {
    if (currentTokens + doc.tokensEstimated < maxContextTokens) {
      contextParts.push(`--- FUENTE: ${doc.title} ---\n${doc.content}\n`);
      currentTokens += doc.tokensEstimated;
      usedDocIds.push(doc.id);
    } else {
      break; 
    }
  }

  // 5. Construir Prompt del Sistema basado en Modo Estricto
  let preamble = "";
  
  if (strictMode) {
    preamble = `
INSTRUCCIONES DE CONTEXTO ESTRICTO (IMPORTANTE):
1. Responde ÚNICAMENTE usando las 'FUENTES' de abajo.
2. ESTRUCTURA DE RESPUESTA OBLIGATORIA:
   - Primero: Un breve resumen en texto de lo encontrado.
   - Segundo: Una TABLA MARKDOWN detallada.
   - Tercero: Conclusiones breves.
3. REGLA DE ORO DE FILAS: Cada fila de datos del documento original debe corresponder a una fila en tu tabla de respuesta. No agrupes múltiples productos en una sola línea. 
4. Si la fuente es un CSV, respeta estrictamente los "saltos de línea" (filas) originales en tu representación.
5. Si no hay información, responde: "No tengo esa información en la base de datos."
`.trim();
  } else {
    preamble = `
INSTRUCCIONES DE CONTEXTO HÍBRIDO:
Utiliza la siguiente información de contexto para enriquecer tu respuesta.
FORMATO: Prioriza el uso de TABLAS MARKDOWN con filas claras para presentar listas de precios, inventario o datos estructurados.
`.trim();
  }

  const contextString = contextParts.length > 0
    ? `${preamble}\n\n=== COMIENZO DE FUENTES ===\n${contextParts.join('\n')}\n=== FIN DE FUENTES ===\n`
    : (strictMode ? "No hay documentos relevantes cargados o encontrados para esta consulta. Responde que no tienes información." : "");

  return { contextString, usedDocIds };
};