// services/message.processor.js
import { handleOrderTrigger } from './message_events/order.handler.js';
import { handleConversationAnalysis } from './message_events/analysis.handler.js';

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
  // La función handleOrderTrigger devuelve `true` si se encargó del mensaje.
  const orderHandled = await handleOrderTrigger(messageData, pendingAnalysisTimers);

  // 2. Si el mensaje no fue para agendar un pedido, procedemos con el análisis general.
  if (!orderHandled) {
    handleConversationAnalysis(messageData, pendingAnalysisTimers);
  }
};
