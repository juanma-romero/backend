// services/commands/reactivar.js
import { updateOrderStatusByNumber } from '../mongo.service.js';

/**
 * Ejecuta el comando para reactivar un pedido cambiando su estado de 'terminado' a 'confirmado_por_admin'.
 * @param {Array<string>} args - Los argumentos del comando. Se espera que el primer argumento sea el número del pedido.
 * @returns {Promise<string>} - Un mensaje de confirmación o error.
 */
export const execute = async (args) => {
  const orderNumberStr = args[0];
  if (!orderNumberStr) {
    return 'Por favor, proporciona un número de pedido. Ejemplo: /reactivar 297';
  }

  const orderNumber = parseInt(orderNumberStr, 10);
  if (isNaN(orderNumber)) {
    return `"${orderNumberStr}" no es un número válido.`;
  }

  try {
    const result = await updateOrderStatusByNumber(orderNumber, 'confirmado_por_admin');

    if (result === null) {
      return `❌ No se encontró ningún pedido con el número #${orderNumber}.`;
    }

    if (result.alreadyInState) {
      return `⚠️ El pedido #${orderNumber} ya se encuentra activo.`;
    }

    return `✅ Pedido #${orderNumber} reactivado y marcado como "confirmado por admin".`;
  } catch (error) {
    console.error(`[Command:reactivar] Error al reactivar el pedido #${orderNumber}:`, error);
    return `Ocurrió un error al intentar reactivar el pedido #${orderNumber}.`;
  }
};
