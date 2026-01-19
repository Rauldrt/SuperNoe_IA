
import { KnowledgeDocument } from '../types';

// Aquí definimos la "Verdad Absoluta" compartida por todos los usuarios.
// Esto reemplaza a Firebase para los datos fijos del negocio.

const PRICES_CSV = `
Producto,Categoría,Precio Unitario,Notas
Yerba Mate Playadito 1kg,Almacén,$3800,Oferta semanal
Yerba Mate Rosamonte 1kg,Almacén,$4100,
Azúcar Ledesma 1kg,Almacén,$1200,Max 2 por persona
Leche La Serenísima 1L,Lácteos,$1400,Cartón
Yogur Bebible Ser 1L,Lácteos,$1800,Sabor Frutilla/Vainilla
Queso Cremoso La Paulina,Lácteos,$8500,El kg
Pan Lactal Fargo Blanco,Panadería,$2200,Paquete grande
Fideos Matarazzo Tallarín 500g,Pastas,$1100,
Arroz Gallo Oro 1kg,Almacén,$1900,No se pasa
Aceite Natura 1.5L,Almacén,$2800,Girasol
Coca Cola 2.25L,Bebidas,$2600,Original/Zero
Cerveza Quilmes 1L,Bebidas,$2100,Retornable
Papel Higiénico Higienol 4u,Limpieza,$3200,80 metros
Jabón Líquido Ariel 3L,Limpieza,$9500,Para lavarropas
Shampoo Plusbelle 1L,Perfumería,$3100,Manzana
Carne Picada Especial,Carnicería,$6500,El kg
Asado de Tira,Carnicería,$8900,El kg - Novillo
Pechuga de Pollo,Carnicería,$5500,El kg
Manzana Roja,Verdulería,$1800,El kg
Banana Ecuador,Verdulería,$2200,El kg
`.trim();

const POLICIES_TEXT = `
--- POLÍTICAS DE NOELIA SUPERMERCADO ---
1. HORARIOS DE ATENCIÓN:
   - Lunes a Sábados: 08:00 a 21:00 hs de corrido.
   - Domingos y Feriados: 09:00 a 13:30 hs.

2. MEDIOS DE PAGO:
   - Aceptamos Efectivo, Tarjetas de Débito y Crédito (Visa, Master, Cabal).
   - Mercado Pago con QR.
   - Cuenta DNI: Reintegro los días Sábados (tope según banco).

3. ENVÍOS A DOMICILIO:
   - Gratis para compras superiores a $30.000 dentro del radio de 20 cuadras.
   - Costo de envío general: $1500.
   - Los pedidos se toman por WhatsApp hasta las 18:00 hs para entrega en el día.

4. DEVOLUCIONES:
   - Se aceptan cambios dentro de las 72hs con ticket de compra y producto cerrado.
   - Productos de heladera no tienen cambio por corte de cadena de frío.
`.trim();

export const STATIC_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'sys-prices-v1',
    title: 'Lista de Precios Oficial (Sistema)',
    content: PRICES_CSV,
    addedAt: Date.now(),
    tokensEstimated: Math.ceil(PRICES_CSV.length / 4),
    isSystem: true
  },
  {
    id: 'sys-policies-v1',
    title: 'Horarios y Políticas (Sistema)',
    content: POLICIES_TEXT,
    addedAt: Date.now(),
    tokensEstimated: Math.ceil(POLICIES_TEXT.length / 4),
    isSystem: true
  }
];
