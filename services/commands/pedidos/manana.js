// services/commands/manana.js
import axios from 'axios';
import { getDateStringInTimezone } from '../../date.service.js';
import { formatOrdersForWhatsapp } from '../../format.service.js';

/**
 * Ejecuta el comando para listar los pedidos agendados para mañana.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje.
 */
export const execute = async () => {
  try {
    const ERP_SERVICE_URL = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const targetDate = getDateStringInTimezone(tomorrow);

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
