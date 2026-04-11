// services/commands/listado.js
import axios from 'axios';
import { formatOrdersForWhatsapp } from '../format.service.js';

/**
 * Ejecuta el comando para listar todos los pedidos.
 * Obtiene los pedidos desde ERPNext vía erp-service, los formatea y devuelve el string resultante.
 * @returns {Promise<string>} - El string formateado con la lista de pedidos o un mensaje de error.
 */
export const execute = async () => {
  try {
    console.log("[Command listado] Ejecutando comando para listar pedidos activos desde ERPNext.");
    
    const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://localhost:8001';
    const response = await axios.get(`${erpServiceUrl}/api/orders/pending`);
    const orders = response.data;

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
