// services/commands/listado.js
import { getAllOrders } from '../mongo.service.js';
import { formatOrdersForWhatsapp } from '../format.service.js';

/**
 * Ejecuta el comando para listar todos los pedidos.
 * Obtiene los pedidos, los formatea y devuelve el string resultante.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje de error.
 */
export const execute = async () => {
  try {
    console.log("[Command listado] Ejecutando comando para listar pedidos activos.");
    const filter = { estado: 'confirmado_por_admin' };
    const orders = await getAllOrders(filter);

    const formattedOrders = formatOrdersForWhatsapp(orders);

    console.log("--- INICIO DEL LISTADO FORMATEADO ---");
    console.log(formattedOrders);
    console.log("--- FIN DEL LISTADO FORMATEADO ---");

    return formattedOrders;
  } catch (error) {
    console.error("[Command listado] Error al ejecutar el comando:", error);
    return "Hubo un error al generar el listado de pedidos.";
  }
};
