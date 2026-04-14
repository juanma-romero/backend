// services/commands/hoy.js
import axios from 'axios';
import { getStartOfDayInTimezone } from '../../date.service.js';
import { formatOrdersForWhatsapp } from '../../format.service.js';

/**
 * Ejecuta el comando para listar los pedidos agendados para hoy.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje.
 */
export const execute = async () => {
  try {
    const ERP_SERVICE_URL = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

    const timeZone = 'Etc/GMT+3';
    const now = new Date();
    const startOfToday = getStartOfDayInTimezone(now, timeZone);
    
    const yyyy = startOfToday.getFullYear();
    const mm = String(startOfToday.getMonth() + 1).padStart(2, '0');
    const dd = String(startOfToday.getDate()).padStart(2, '0');
    const targetDate = `${yyyy}-${mm}-${dd}`;

    console.log(`[Command hoy] Petición a ERP Service: GET ${ERP_SERVICE_URL}/api/orders/pending?date=${targetDate}`);

    const response = await axios.get(`${ERP_SERVICE_URL}/api/orders/pending?date=${targetDate}`);
    const orders = response.data;

    console.log(`[Command hoy] Pedidos encontrados por ERPNext: ${orders.length}`);

    return orders.length > 0 ? formatOrdersForWhatsapp(orders) : 'No hay pedidos agendados para hoy.';
  } catch (error) {
    console.error("[Command hoy] Error al ejecutar el comando:", error.message);
    return "Hubo un error al generar el listado de pedidos de hoy.";
  }
};
