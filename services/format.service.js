/**
 * Formatea una lista de pedidos en un string legible para WhatsApp.
 * @param {Array<Object>} orders - El array de documentos de pedido desde MongoDB.
 * @returns {string} - Un único string con todos los pedidos formateados.
 */
export const formatOrdersForWhatsapp = (orders) => {
  if (!orders || orders.length === 0) {
    return 'No hay pedidos pendientes para mostrar.';
  }

  return orders.map(order => {
    // Extraemos el número de teléfono del cliente del remoteJid
    const clientNumber = order.remoteJid.split('@')[0];
    const deliveryInfo = order.fecha_hora_entrega || 'Entrega no especificada';
    
    const productDetails = order.productos
      .map(p => `${p.cantidad} ${p.nombre}`)
      .join('\n');
      
    const totalAmount = order.monto_total || 'Monto no especificado';

    return `---------
Pedido de: ${clientNumber}
${deliveryInfo}
${productDetails}
${totalAmount}`;
  }).join('\n\n'); // Usamos doble salto de línea para separar mejor los pedidos
};
