// services/commands/completo.js
import axios from 'axios';

/**
 * Ejecuta el comando para marcar un pedido como 'terminado' o 'entregado'.
 * @param {Array<string>} args - Los argumentos del comando. Se espera que el primer argumento sea el ID del pedido en ERPNext.
 * @returns {Promise<string>} - Un mensaje de confirmación o error.
 */
export const execute = async (args) => {
  const orderIdStr = args[0];
  if (!orderIdStr) {
    return 'Por favor, proporciona un ID de pedido. Ejemplo: /hecho SALES-ORD-2026-00001';
  }

  const orderId = orderIdStr.trim();
  const ERP_SERVICE_URL = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

  try {
    console.log(`[Command completo] Solicitando marcado de entrega para ${orderId} en ${ERP_SERVICE_URL}`);
    const result = await axios.post(`${ERP_SERVICE_URL}/api/orders/${orderId}/deliver`);
    
    if (result.data && result.data.success) {
      return `✅ Pedido ${orderId} marcado como entregado con el remito ${result.data.delivery_note}.`;
    }
    
    return `⚠️ ${orderId} tuvo una respuesta inesperada: ${JSON.stringify(result.data)}`;
  } catch (error) {
    console.error(`[Command:hecho] Error al actualizar el pedido ${orderId}:`, error.message);
    
    // Check if it's a 404 or 500 error from backend
    if (error.response) {
      if (error.response.status === 404 || (error.response.data && error.response.data.detail && error.response.data.detail.includes("Not Found"))) {
         return `❌ No se encontró ningún pedido con el ID ${orderId}.`;
      }
      return `Ocurrió un error en el sistema ERP al intentar procesar ${orderId}. Detalle: ${error.response.data.detail || error.message}`;
    }
    
    return `Ocurrió un error de red al intentar actualizar el pedido ${orderId}.`;
  }
};
