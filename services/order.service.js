import { saveOrderToDb, getRecentMessages, updateChatAnalysis, getChatByJid } from './mongo.service.js';
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
 * Obtiene la fecha y hora actual formateada para el prompt.
 * @returns {string} - La fecha y hora formateada.
 */
const getCurrentFormattedDateTime = () => {
    const now = new Date();
    // Se usa 'Etc/GMT+3' para forzar un offset de UTC-3, ya que 'America/Asuncion'
    // puede resolverse a UTC-4 en sistemas con datos de zona horaria desactualizados.
    const timeZone = 'Etc/GMT+3';

    // Opciones para formatear la fecha y hora en la zona horaria correcta
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timeZone,
    };

    const formatter = new Intl.DateTimeFormat('es-ES', options);
    const parts = formatter.formatToParts(now);

    const dateParts = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    const dayOfWeek = dateParts.weekday.charAt(0).toUpperCase() + dateParts.weekday.slice(1);

    return `${dayOfWeek}, ${dateParts.day}-${dateParts.month}-${dateParts.year} ${dateParts.hour}:${dateParts.minute}`;
};

/**
 * Dispara el análisis de la conversación para la toma de un pedido.
 * Se llama cuando se detecta el comando "Entonces te agendo:".
 * @param {string} contactJid - El ID del contacto del chat.
 */
export const triggerOrderAnalysis = async (contactJid) => {
  try {
    const conversationHistory = await getRecentMessages(contactJid, 20); // Obtenemos los últimos 20 mensajes para tener más contexto.
    const conversationText = formatMessagesForPrompt(conversationHistory);

    const currentDateTime = getCurrentFormattedDateTime();
    const formattedPrompt = `Contexto Adicional:\n- Fecha y hora de la solicitud del pedido: ${currentDateTime}\n\n--- Historial de Conversación ---\n${conversationText}`;

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
    const orderDocumentData = { ...orderData };

    // --- CORRECCIÓN CRÍTICA ---
    // La IA devuelve la fecha como un string. Debemos convertirla a un objeto Date de JS
    // para que MongoDB la guarde con el tipo de dato correcto (BSON Date) y así los
    // filtros de fecha ($gte, $lt) funcionen correctamente.
    if (orderDocumentData.fecha_hora_entrega && typeof orderDocumentData.fecha_hora_entrega === 'string') {
      const dateObject = new Date(orderDocumentData.fecha_hora_entrega);
      if (!isNaN(dateObject)) {
        orderDocumentData.fecha_hora_entrega = dateObject;
        console.log(`[order.service] 'fecha_hora_entrega' convertida a objeto Date: ${dateObject.toISOString()}`);
      } else {
        console.warn(`[order.service] 'fecha_hora_entrega' recibida no es un string de fecha válido: ${orderDocumentData.fecha_hora_entrega}`);
      }
    }

    // --- INICIO DEBUG ---
    // Buscamos el nombre del contacto asociado a este JID.
    const contactName = await getChatByJid(orderData.remoteJid);
    console.log(`[order.service - DEBUG] Buscando nombre para ${orderData.remoteJid}.`);
    console.log(`[order.service - DEBUG] Nombre de contacto a guardar: "${contactName}"`);
    // --- FIN DEBUG ---

    const orderDocument = {
      ...orderDocumentData,
      contactName: contactName, // Guardamos el nombre del contacto en el pedido
      estado: 'confirmado_por_admin',
      aprobado_por_cliente: false,
      createdAt: new Date()
    };
    const savedOrder = await saveOrderToDb(orderDocument);

    if (savedOrder) {
      console.log('[order.service] Pedido guardado en la DB:', JSON.stringify(savedOrder, null, 2));
      // Actualizamos el estado de la conversación a 'Pedido Creado'
      await updateChatAnalysis(orderData.remoteJid, 'Pedido Creado');
      console.log(`[order.service] Estado de conversación para ${orderData.remoteJid} actualizado a 'Pedido Creado'.`);
    }

    return savedOrder;
  } catch (error) {
    console.error('[order.service] Error al crear el pedido:', error);
    return null;
  }
};
