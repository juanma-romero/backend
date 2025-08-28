// services/commands/hoy.js
import { getAllOrders } from '../mongo.service.js';
import { getStartOfDayInTimezone } from '../date.service.js';
import { formatOrdersForWhatsapp } from '../format.service.js';

/**
 * Ejecuta el comando para listar los pedidos agendados para hoy, ordenados por hora.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje.
 */
export const execute = async () => {
  try {
    // Se usa 'Etc/GMT+3' para forzar un offset de UTC-3, ya que 'America/Asuncion'
    // puede resolverse a UTC-4 en sistemas con datos de zona horaria desactualizados.
    const timeZone = 'Etc/GMT+3';
    const now = new Date();
    const startOfToday = getStartOfDayInTimezone(now, timeZone);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const filter = {
      fecha_hora_entrega: {
        $gte: startOfToday,
        $lt: endOfToday
      }
    };

    // --- INICIO DE LOGS PARA DEBUG ---
    console.log(`[Command hoy - DEBUG] Buscando pedidos entre:`);
    console.log(`[Command hoy - DEBUG] >= ${startOfToday.toISOString()}`);
    console.log(`[Command hoy - DEBUG] <  ${endOfToday.toISOString()}`);
    // --- FIN DE LOGS PARA DEBUG ---

    // Ordenación ascendente por fecha de entrega
    const sort = { fecha_hora_entrega: 1 };

    console.log("[Command hoy] Ejecutando comando para listar pedidos de hoy.");
    // Obtiene todas los pedidos aplicando filtros y odenado
    const orders = await getAllOrders(filter, sort);
    console.log(`[Command hoy - DEBUG] Pedidos encontrados por la consulta: ${orders.length}`);

    // Corregido: Comprobar si hay pedidos ANTES de formatear.
    return orders.length > 0 ? formatOrdersForWhatsapp(orders) : 'No hay pedidos agendados para hoy.';
  } catch (error) {
    console.error("[Command hoy] Error al ejecutar el comando:", error);
    return "Hubo un error al generar el listado de pedidos de hoy.";
  }
};