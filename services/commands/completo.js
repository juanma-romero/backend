// services/commands/completo.js
import { updateOrderStatusByNumber } from '../mongo.service.js';

/**
 * Ejecuta el comando para marcar un pedido como 'terminado'.
 * @param {Array<string>} args - Los argumentos del comando. Se espera que el primer argumento sea el número del pedido.
 * @returns {Promise<string>} - Un mensaje de confirmación o error.
 */
export const execute = async (args) => {
  const orderNumberStr = args[0];
  if (!orderNumberStr) {
    return 'Por favor, proporciona un número de pedido. Ejemplo: /hecho 297';
  }

  const orderNumber = parseInt(orderNumberStr, 10);
  if (isNaN(orderNumber)) {
    return `"${orderNumberStr}" no es un número válido.`;
  }

  try {
    const result = await updateOrderStatusByNumber(orderNumber, 'terminado');

    if (result === null) {
      return `❌ No se encontró ningún pedido con el número #${orderNumber}.`;
    }

    if (result.alreadyInState) {
      return `⚠️ #${orderNumber} ya fue terminado anteriormente. Revise el numero de pedido !!!`;
    }

    return `✅ Pedido #${orderNumber} marcado como terminado.`;
  } catch (error) {
    console.error(`[Command:hecho] Error al actualizar el pedido #${orderNumber}:`, error);
    return `Ocurrió un error al intentar actualizar el pedido #${orderNumber}.`;
  }
};
