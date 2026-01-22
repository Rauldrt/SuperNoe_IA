
import { KnowledgeDocument } from '../types';

// ESTRATEGIA HÍBRIDA - PARTE 1: DATOS DUROS (ESENCIALES)
// Estos datos siempre están disponibles, no dependen de internet ni de Sheets.

const POLICIES_TEXT = `
--- INFORMACIÓN INSTITUCIONAL DE NOELIA SUPERMERCADO ---

1. UBICACIÓN Y HORARIOS:
   - Dirección: Av. Siempreviva 742.
   - Lunes a Sábados: 08:00 a 21:00 hs de corrido.
   - Domingos y Feriados: 09:00 a 13:30 hs.

2. MEDIOS DE PAGO ACEPTADOS:
   - Efectivo (10% de descuento en el acto).
   - Tarjetas de Débito y Crédito (Visa, Master, Cabal).
   - Mercado Pago (Transferencia o QR).
   - Cuenta DNI: Reintegro los días Sábados (tope según banco provincia).

3. ENVÍOS A DOMICILIO (DELIVERY):
   - Gratis para compras superiores a $30.000 (radio 20 cuadras).
   - Costo de envío general: $1500.
   - Los pedidos se toman por WhatsApp hasta las 18:00 hs para entrega en el día.

4. POLÍTICA DE DEVOLUCIONES:
   - Se aceptan cambios dentro de las 72hs con ticket de compra y producto cerrado.
   - IMPORTANTE: Productos de heladera/freezer NO tienen cambio por corte de cadena de frío.
`.trim();

export const STATIC_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'sys-policies-core',
    title: 'Políticas y Horarios (Esencial)',
    content: POLICIES_TEXT,
    addedAt: Date.now(),
    tokensEstimated: Math.ceil(POLICIES_TEXT.length / 4),
    isSystem: true
  }
];
