import { saveOrderToDb, getRecentMessages } from './mongo.service.js';
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
 * Dispara el análisis de la conversación para la toma de un pedido.
 * Se llama cuando se detecta el comando "Entonces te agendo:".
 * @param {string} contactJid - El ID del contacto del chat.
 */
export const triggerOrderAnalysis = async (contactJid) => {
  try {
    const conversationHistory = await getRecentMessages(contactJid, 20); // Obtenemos los últimos 20 mensajes para tener más contexto.
    const formattedPrompt = formatMessagesForPrompt(conversationHistory);

    console.log(`[order.service] Enviando historial a IA para análisis de pedido.`);
    const analysisResult = await queryIAService('/analyze-order', formattedPrompt);

    if (analysisResult && analysisResult.pedido_detectado) {
      console.log("[order.service] Pedido detectado. Creando orden...");
      const newOrder = {
        remoteJid: contactJid,
        ...analysisResult // Copiamos toda la info extraída
      };
      
      await createOrder(newOrder);       

      // Aquí podrías agregar la lógica para enviar una respuesta de confirmación a WhatsApp.
      // Ejemplo: sendMessage(contactJid, `Pedido agendado: ${JSON.stringify(newOrder.productos)}`);

    } else {
      console.warn("[order.service] El servicio de IA no detectó un pedido formal.");
    }
  } catch (error) {
    console.error('[order.service] Error en el análisis de pedido:', error);
  }
};

/**
 * Crea un nuevo documento de pedido en la base de datos.
 * @param {Object} orderData - Los datos del pedido extraídos por la IA.
 */
export const createOrder = async (orderData) => {
  try {
    // Mantenemos la estructura del documento del pedido como estaba.
    const orderDocument = {
      ...orderData,
      estado: 'confirmado_por_admin',
      aprobado_por_cliente: false,
      createdAt: new Date()
    };
    const savedOrder = await saveOrderToDb(orderDocument);
    console.log('[order.service] Pedido guardado en la DB:', JSON.stringify(savedOrder, null, 2));
    return savedOrder;
  } catch (error) {
    console.error('[order.service] Error al crear el pedido:', error);
    return null;
  }
};
