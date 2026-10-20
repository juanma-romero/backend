// services/message.processor.js
import { handleOrderTrigger } from './message_events/order.handler.js';
import { handlePaymentTrigger } from './message_events/payment.handler.js';
import { handleDeliveryTrigger } from './message_events/delivery.handler.js';
import { handleConversationAnalysis } from './message_events/analysis.handler.js';
import { handleClientResponseForPendingOrder } from './pending_orders.service.js';

// Usamos un Map para manejar los temporizadores de análisis pendientes por cada chat.
// Este Map se gestionará aquí, en el procesador central.
const pendingAnalysisTimers = new Map();

/**
 * Procesa un mensaje entrante de un cliente y delega a los manejadores apropiados.
 * @param {object} messageData - El objeto completo del mensaje.
 */
export const processMessage = async (messageData) => {
  if (!messageData || !messageData.key) {
    console.warn("[MessageProcessor] Se intentó procesar un mensaje sin datos clave.");
    return;
  }

  // 1. Intentar manejar el evento de agendar pedido primero.
  const orderHandled = await handleOrderTrigger(messageData, pendingAnalysisTimers);
  if (orderHandled) {
    return;
  }

  // 1.5. Intentar manejar el evento de acreditación de pago ("Acreditado ...")
  const paymentHandled = await handlePaymentTrigger(messageData);
  if (paymentHandled) {
    return;
  }

  // 1.6. Intentar manejar los gatillos de entrega ("Pedido en camino" / "Pedido entregado")
  const deliveryHandled = await handleDeliveryTrigger(messageData);
  if (deliveryHandled) {
    return;
  }

  // 2. Si el mensaje proviene del cliente (no es fromMe), verificar si tiene un pedido pendiente por confirmar.
  if (!messageData.key.fromMe) {
    const pendingHandled = await handleClientResponseForPendingOrder(messageData);
    if (pendingHandled) {
      console.log(`[MessageProcessor] Mensaje de cliente procesado por el flujo de confirmación de pedido pendiente.`);
      return;
    }
  }

  // 3. Si el mensaje no fue para agendar ni confirmó/modificó un pedido pendiente, procedemos con el análisis general.
  handleConversationAnalysis(messageData, pendingAnalysisTimers);
};
