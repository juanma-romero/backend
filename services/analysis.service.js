import { getRecentMessages, updateChatAnalysis } from './mongo.service.js';
import { queryIAService } from './ia.service.js'
import { createOrder } from './order.service.js'
 
/**
 * Formatea los mensajes de la DB a un string simple para el prompt de la IA.
 * @param {Array} messages - Array de objetos de mensaje.
 * @returns {string} - El historial formateado.
 */
const formatMessagesForPrompt = (messages) => {
    return messages
        .map(msg => {
            const prefix = msg.role === 'user' ? 'Cliente:' : 'Admin:';
            return `${prefix} ${msg.content || ''}`;
        })
        .join('\n');
};

/**
 * Orquesta el proceso completo de análisis de una conversación.
 * @param {string} contactJid - El JID del contacto a analizar.
 */
export const triggerConversationAnalysis = async (contactJid) => {
  try {
    // Corregido: Llamar a getRecentMessages y ajustar el formato del prompt.
    const conversationHistory = await getRecentMessages(contactJid, 15); // Obtenemos los últimos 15 mensajes.
    const formattedPrompt = formatMessagesForPrompt(conversationHistory);

    const analysisResult = await queryIAService('/analyze-conversation', formattedPrompt);

    if (analysisResult && analysisResult.pedido_detectado) {
      const newOrder = {
        remoteJid: contactJid,
        ...analysisResult 
      };
      await createOrder(newOrder);
    } else if (analysisResult && analysisResult.state) {
        // Guardamos el resultado del análisis en la base de datos.
        await updateChatAnalysis(contactJid, analysisResult.state, analysisResult.summary);
        console.log(`[analysis.service] Análisis de estado para ${contactJid}: Estado: ${analysisResult.state}, Resumen: ${analysisResult.summary}`);
    } else {
      console.warn("[analysis.service] No se pudo analizar la conversación o no se detectó un pedido.");
    }
  } catch (error) {
    console.error('[analysis.service] Error en el análisis de conversación:', error);
  }
};
