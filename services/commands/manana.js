// services/commands/manana.js
import { getAllOrders } from '../mongo.service.js';
import { getStartOfDayInTimezone } from '../date.service.js';
import { formatOrdersForWhatsapp } from '../format.service.js';

/**
 * Ejecuta el comando para listar los pedidos agendados para mañana, ordenados por hora.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje.
 */
export const execute = async () => {
  try {
    // Se usa 'Etc/GMT+3' para forzar un offset de UTC-3, ya que 'America/Asuncion'
    // puede resolverse a UTC-4 en sistemas con datos de zona horaria desactualizados.
    const timeZone = 'Etc/GMT+3';
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const startOfTomorrow = getStartOfDayInTimezone(tomorrow, timeZone);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    // Filtro para obtener pedidos durante el día de mañana
    const filter = {
      fecha_hora_entrega: {
        $gte: startOfTomorrow,
        $lt: endOfTomorrow
      },
      estado: 'confirmado_por_admin'
    };

    const sort = { fecha_hora_entrega: 1 }; // Ordenación ascendente

    console.log("[Command manana] Ejecutando comando para listar pedidos de mañana.");
    const orders = await getAllOrders(filter, sort);

    return orders.length > 0 ? formatOrdersForWhatsapp(orders) : 'No hay pedidos agendados para mañana.';
  } catch (error) {
    console.error("[Command manana] Error al ejecutar el comando:", error);
    return "Hubo un error al generar el listado de pedidos de mañana.";
  }
};
