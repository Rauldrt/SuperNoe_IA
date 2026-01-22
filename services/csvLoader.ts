
import { KnowledgeDocument } from '../types';

/**
 * Convierte texto CSV crudo en una tabla Markdown formateada.
 * Esto ayuda enormemente a que Gemini entienda la estructura de filas y columnas.
 */
const csvToMarkdownTable = (csvText: string): string => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return '';

    // Asumimos que la primera línea son los encabezados
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Crear separador Markdown |---|---|
    const separator = headers.map(() => '---');
    
    let md = `| ${headers.join(' | ')} |\n| ${separator.join(' | ')} |`;

    // Procesar filas de datos
    for (let i = 1; i < lines.length; i++) {
        // Manejo básico de comas dentro de comillas si fuera necesario, 
        // pero para Sheets "Publicar como CSV" estándar, un split suele bastar si no hay comas en los nombres.
        // Para mayor robustez, regex simple para split por coma:
        const cells = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
        
        // Rellenar celdas vacías si la fila es corta
        while (cells.length < headers.length) cells.push('');
        
        md += `\n| ${cells.join(' | ')} |`;
    }

    return md;
};

export const fetchCsvKnowledge = async (url: string): Promise<KnowledgeDocument | null> => {
    if (!url || !url.includes('http')) return null;

    try {
        console.log(`fetching csv from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const csvText = await response.text();
        const markdownContent = csvToMarkdownTable(csvText);

        if (!markdownContent) return null;

        return {
            id: 'sys-csv-dynamic',
            title: 'Lista de Precios y Productos (Dinámica)',
            content: `--- BASE DE DATOS DE PRODUCTOS (ACTUALIZADA) ---\nFormato: Tabla Markdown\n\n${markdownContent}`,
            addedAt: Date.now(),
            tokensEstimated: Math.ceil(markdownContent.length / 4),
            isSystem: true
        };

    } catch (error) {
        console.error("Error fetching CSV knowledge:", error);
        throw error;
    }
};
