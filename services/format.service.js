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
      console.log(`[Formatter] Procesando pedido #${index + 1}, ID: ${order._id}`);
      
      // Verificación defensiva para productos
      if (!order.productos || !Array.isArray(order.productos)) {
        console.warn(`[Formatter] El pedido ${order._id} no tiene un array de productos válido.`);
        return `---------
Pedido con datos incompletos (ID: ${order._id.toString().slice(-6)})`;
      }

      const clientNumber = order.remoteJid ? order.remoteJid.split('@')[0] : 'Cliente no especificado';
      const deliveryInfo = order.fecha_hora_entrega || 'Entrega no especificada';
      
      const productDetails = order.productos
        .map(p => `${p.cantidad || '?'} ${p.nombre || 'Producto sin nombre'}`)
        .join('\n');
        
      const totalAmount = order.monto_total || 'Monto no especificado';

      return `---------
Pedido de: ${clientNumber}
${deliveryInfo}
${productDetails}
${totalAmount}`;
    } catch (error) {
      console.error(`[Formatter] Error al procesar el pedido con ID: ${order._id}`, error);
      return `---------
Error al procesar pedido ID: ${order._id}`;
    }
  }).join('\n\n');
};
