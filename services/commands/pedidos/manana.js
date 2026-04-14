// services/commands/manana.js
import axios from 'axios';
import { getStartOfDayInTimezone } from '../../date.service.js';
import { formatOrdersForWhatsapp } from '../../format.service.js';

/**
 * Ejecuta el comando para listar los pedidos agendados para mañana.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje.
 */
export const execute = async () => {
  try {
    const ERP_SERVICE_URL = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

    const timeZone = 'Etc/GMT+3';
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const startOfTomorrow = getStartOfDayInTimezone(tomorrow, timeZone);
    
    const yyyy = startOfTomorrow.getFullYear();
    const mm = String(startOfTomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(startOfTomorrow.getDate()).padStart(2, '0');
    const targetDate = `${yyyy}-${mm}-${dd}`;

    console.log(`[Command manana] Petición a ERP Service: GET ${ERP_SERVICE_URL}/api/orders/pending?date=${targetDate}`);

    const response = await axios.get(`${ERP_SERVICE_URL}/api/orders/pending?date=${targetDate}`);
    const orders = response.data;

    console.log(`[Command manana] Pedidos encontrados por ERPNext: ${orders.length}`);

    return orders.length > 0 ? formatOrdersForWhatsapp(orders) : 'No hay pedidos agendados para mañana.';
  } catch (error) {
    console.error("[Command manana] Error al ejecutar el comando:", error.message);
    return "Hubo un error al generar el listado de pedidos de mañana.";
  }
};
