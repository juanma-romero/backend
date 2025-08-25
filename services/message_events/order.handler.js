// services/message_events/order.handler.js
import { triggerOrderAnalysis } from '../order.service.js';

/**
 * Maneja la detección del comando de agendamiento de pedido.
 * @param {object} messageData - El objeto completo del mensaje.
 * @param {Map} pendingAnalysisTimers - El Map de temporizadores para poder limpiarlo.
 * @returns {boolean} - Devuelve true si el evento fue manejado, de lo contrario false.
 */
export const handleOrderTrigger = async (messageData, pendingAnalysisTimers) => {
  const contactJid = messageData.key.remoteJid;
  const isFromMe = messageData.key.fromMe;
  const textContent = messageData.content || '';

  if (isFromMe && textContent.startsWith('Entonces te agendo:')) {
    console.log(`[OrderHandler] Comando de agendar detectado. Disparando análisis de pedido.`);
    
    // Detenemos cualquier temporizador de análisis de estado pendiente
    if (pendingAnalysisTimers.has(contactJid)) {
      clearTimeout(pendingAnalysisTimers.get(contactJid));
      pendingAnalysisTimers.delete(contactJid);
      console.log(`[OrderHandler] Temporizador de análisis previo para ${contactJid} detenido.`);
    }

    // Llama a la función de análisis de pedido
    await triggerOrderAnalysis(contactJid);
    
    return true; // Indicamos que este manejador se hizo cargo del mensaje.
  }

  return false; // No era un mensaje para agendar.
};
