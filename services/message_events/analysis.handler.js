// services/message_events/analysis.handler.js
import { triggerConversationAnalysis } from '../analysis.service.js';

const ANALYSIS_DELAY = 60000; // 60 segundos

/**
 * Maneja la lógica de análisis de conversación con retardo.
 * @param {object} messageData - El objeto completo del mensaje.
 * @param {Map} pendingAnalysisTimers - El Map de temporizadores para gestionar el retardo.
 */
export const handleConversationAnalysis = (messageData, pendingAnalysisTimers) => {
  const contactJid = messageData.key.remoteJid;

  // Si ya hay un temporizador para este chat, lo reiniciamos.
  if (pendingAnalysisTimers.has(contactJid)) {
    clearTimeout(pendingAnalysisTimers.get(contactJid));
  }

  const timerId = setTimeout(() => {
    console.log(`[AnalysisHandler] Tiempo de calma finalizado para ${contactJid}. Disparando análisis de estado.`);
    triggerConversationAnalysis(contactJid);
    pendingAnalysisTimers.delete(contactJid); // Limpiamos el temporizador del Map una vez ejecutado.
  }, ANALYSIS_DELAY);

  // Guardamos el nuevo temporizador en el Map.
  pendingAnalysisTimers.set(contactJid, timerId);
  console.log(`[AnalysisHandler] Temporizador de análisis programado para ${contactJid}.`);
};
