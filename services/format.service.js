/**
 * Formatea una fecha para mostrar en el formato deseado.
 * @param {Date} date - La fecha a formatear.
 * @returns {string} - La fecha formateada.
 */
const formatDateForDisplay = (date) => {
  if (!date || !(date instanceof Date)) {
    return 'Fecha no disponible';
  }

  const timeZone = 'America/Asuncion';

  const options = {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZone,
  };

  const formatter = new Intl.DateTimeFormat('es-ES', options);
  const parts = formatter.formatToParts(date);

  const dateParts = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const dayOfWeek = dateParts.weekday.charAt(0).toUpperCase() + dateParts.weekday.slice(1);

  // Obtener el offset de zona horaria
  const timeZoneOffset = date.toLocaleString('es-ES', { timeZone, timeZoneName: 'short' }).split(' ').pop();

  return `${dayOfWeek} ${dateParts.day}-${dateParts.month} ${dateParts.hour}:${dateParts.minute} [${timeZoneOffset}]`;
};

/**
 * Formatea una lista de pedidos en un string legible para WhatsApp.
 * @param {Array<Object>} orders - El array de documentos de pedido desde MongoDB.
 * @returns {string} - Un único string con todos los pedidos formateados.
 */
export const formatOrdersForWhatsapp = (orders) => {
  if (!orders || orders.length === 0) {
    return 'No hay pedidos pendientes para mostrar.';
  }

  return orders.map((order, index) => {
    try {
      const numeroPedido = order.numero_pedido || (index + 1);
      console.log(`[Formatter] Procesando pedido #${numeroPedido}`);
      //console.log(order)
      // Verificación defensiva para productos
      if (!order.productos || !Array.isArray(order.productos)) {
        console.warn(`[Formatter] El pedido ${numeroPedido} no tiene un array de productos válido.`);
        return `---------
Pedido #${numeroPedido} con datos incompletos`;
      }

      // Prepara el identificador del cliente, mostrando el nombre si está disponible.
      const clientNumber = order.remoteJid ? order.remoteJid.split('@')[0] : 'Desconocido'; // Se declara una sola vez
      const clientIdentifier = order.contactName ? `${order.contactName} (${clientNumber})` : clientNumber;

      const deliveryInfo = order.fecha_hora_entrega ? formatDateForDisplay(new Date(order.fecha_hora_entrega)) : 'Entrega no especificada';

      const productDetails = order.productos
        .map(p => `${p.cantidad || '?'} ${p.nombre || 'Producto sin nombre'}`)
        .join('\n');

      const totalAmount = order.monto_total || 'Monto no especificado';

      return `---------
Pedido #${numeroPedido} de: ${clientIdentifier}
${deliveryInfo}
${productDetails}
${totalAmount}`;
    } catch (error) {
      const numeroPedido = order.numero_pedido || (index + 1);
      console.error(`[Formatter] Error al procesar el pedido #${numeroPedido}`, error);
      return `---------
Error al procesar pedido #${numeroPedido}`;
    }
  }).join('\n\n');
};

/**
 * Extrae texto de forma segura del nuevo payload de Baileys.
 * @param {Object} messageData - El objeto del mensaje entrante.
 * @returns {string} - El texto extraído.
 */
export const getMessageText = (messageData) => {
  if (!messageData) return '';
  // Fallback por si usamos el formato viejo en algún simulador sin actualizar:
  if (messageData.content && typeof messageData.content === 'string') return messageData.content;
  if (!messageData.message) return '';
  
  const msg = messageData.message;
  if (typeof msg === 'string') return msg;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage && msg.extendedTextMessage.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage && msg.imageMessage.caption) return msg.imageMessage.caption;
  return '';
};
