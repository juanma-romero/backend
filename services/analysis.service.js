import { getRecentMessages, updateChatAnalysis } from './mongo.service.js';
import { queryIAService } from './ia.service.js';

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
    console.log(`[Analysis] Iniciando análisis para ${contactJid}...`);

    // 1. Obtener los últimos 10 mensajes (como definiste).
    const recentMessages = await getRecentMessages(contactJid, 10);
    if (recentMessages.length === 0) {
        console.log(`[Analysis] No se encontraron mensajes para ${contactJid}. Abortando.`);
        return;
    }

    // 2. Formatear los mensajes para que la IA los entienda.
    const formattedPrompt = formatMessagesForPrompt(recentMessages);

    // 3. Llamar al servicio de IA con el prompt formateado.
    const analysisResult = await queryIAService(formattedPrompt);

    // 4. Si la IA respondió correctamente, actualizar la base de datos.
    if (analysisResult && analysisResult.state && analysisResult.summary) {
        await updateChatAnalysis(contactJid, analysisResult.state, analysisResult.summary);
    } else {
        console.error(`[Analysis] El análisis falló o retornó un formato inesperado para ${contactJid}.`, analysisResult);
    }
};