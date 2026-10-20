// services/message_events/delivery.handler.js
import axios from 'axios';
import { sendClientMessage, alertAdminOnly } from '../notification.service.js';

/**
 * Maneja los gatillos de entrega de pedido escritos por el admin en el chat con el cliente:
 *   - "Pedido en camino ..."   (delivery: el repartidor sale con el pedido)
 *   - "Pedido entregado ..."   (retiro: el cliente pasó a buscar y se entrega)
 * Ambos marcan el pedido como entregado en ERPNext (genera el remito/Delivery Note)
 * usando el último pedido activo del cliente de ese chat.
 * @param {object} messageData - El objeto completo del mensaje.
 * @returns {boolean} - Devuelve true si el evento fue manejado, de lo contrario false.
 */

const TRIGGERS = [
  { prefix: 'pedido en camino', kind: 'onway' },
  { prefix: 'pedido entregado', kind: 'delivered' },
];

export const handleDeliveryTrigger = async (messageData) => {
  const contactJid = messageData.key.remoteJid;
  const isFromMe = messageData.key.fromMe;
  const textContent = messageData.textContent || '';

  if (!isFromMe) return false;

  const normalized = textContent.toLowerCase().trim();
  const trigger = TRIGGERS.find((t) => normalized.startsWith(t.prefix));
  if (!trigger) return false;

  console.log(`[DeliveryHandler] Gatillo de entrega detectado ("${textContent.substring(0, 40)}") para JID: ${contactJid}`);

  const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://erp_service:8001';

  try {
    const response = await axios.post(`${erpServiceUrl}/api/orders/${contactJid}/deliver`);
    const data = response.data;

    if (data.success) {
      const orderId = data.order_id ? ` (${data.order_id})` : '';
      const remito = data.delivery_note ? ` Remito: ${data.delivery_note}.` : '';
      let reply;
      if (trigger.kind === 'onway') {
        reply = `🚚 Entrega registrada en sistema: pedido en camino${orderId}.${remito}`;
      } else {
        reply = `✅ Pedido entregado y registrado en sistema${orderId}.${remito}`;
      }
      console.log(`[DeliveryHandler] ${reply}`);
      // Confirmación visible para el cliente Y espejada al panel (mirror por defecto)
      await sendClientMessage(contactJid, reply);
    } else {
      // Fallo (ej. pedido ya entregado, sin pedidos activos): SOLO al admin, nada al cliente
      await alertAdminOnly(contactJid, `⚠️ Gatillo "${textContent}" no se pudo registrar en el ERP: el pedido ya estaría entregado o no hay pedido activo.`);
    }
  } catch (error) {
    console.error(`[DeliveryHandler] Error registrando entrega para ${contactJid}:`, error.response?.data || error.message);
    const errDetail = error.response?.data?.detail || error.message;
    // Error del ERP: SOLO al admin (nota privada), el cliente no ve nada
    await alertAdminOnly(contactJid, `⚠️ Gatillo "${textContent}" no registrado en ERP: ${errDetail}`);
  }

  return true;
};
