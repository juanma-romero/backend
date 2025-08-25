// services/commands/listado.js
import { getAllOrders } from '../mongo.service.js';

/**
 * Ejecuta el comando para listar todos los pedidos.
 * Por ahora, solo los imprime en la consola del backend.
 */
export const execute = async () => {
  try {
    console.log("[Command /listado] Ejecutando comando para listar pedidos.");
    const orders = await getAllOrders();
    console.log("[Command /listado] Listado de pedidos:", JSON.stringify(orders, null, 2));
    // Aquí, en el futuro, se podría formatear y enviar la respuesta a WhatsApp.
  } catch (error) {
    console.error("[Command /listado] Error al ejecutar el comando:", error);
  }
};
