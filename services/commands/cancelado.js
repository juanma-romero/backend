// services/commands/cancelado.js
import axios from 'axios';

/**
 * Ejecuta el comando para marcar un pedido como 'cancelado'.
 * @param {Array<string>} args - Los argumentos del comando. Se espera que el primer argumento sea el ID del pedido en ERPNext.
 * @returns {Promise<string>} - Un mensaje de confirmación o error.
 */
export const execute = async (args) => {
  const orderIdStr = args[0];
  if (!orderIdStr) {
    return 'Por favor, proporciona un ID de pedido. Ejemplo: /cancelado SALES-ORD-2026-00001';
  }

  const orderId = orderIdStr.trim();
  const ERP_SERVICE_URL = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

  try {
    console.log(`[Command cancelado] Solicitando cancelación para ${orderId} en ${ERP_SERVICE_URL}`);
    const result = await axios.post(`${ERP_SERVICE_URL}/api/orders/${orderId}/cancel`);
    
    if (result.data && result.data.success) {
      return `✅ Pedido ${orderId} marcado como CANCELADO exitosamente en el sistema.`;
    }
    
    return `⚠️ ${orderId} tuvo una respuesta inesperada: ${JSON.stringify(result.data)}`;
  } catch (error) {
    console.error(`[Command:cancelado] Error al actualizar el pedido ${orderId}:`, error.message);
    
    if (error.response) {
      if (error.response.status === 404) {
         return `❌ No se encontró ningún pedido con el ID ${orderId}.`;
      }
      
      // Manejar el error 409 o 500 donde ERPNext bloquea por pagos vinculados o reglas contables
      const errorDetail = error.response.data.detail || error.message;
      return `⚠️ No se pudo cancelar la orden automáticamente. Debes revisarlo manual en el ERP.\n\nMotivo:\n${errorDetail}`;
    }
    
    return `Ocurrió un error de red al intentar actualizar el pedido ${orderId}.`;
  }
};
