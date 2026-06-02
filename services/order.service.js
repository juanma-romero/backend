import { getRecentMessages, updateChatAnalysis, getChatByJid } from './mongo.service.js';
import { queryIAService } from './ia.service.js';
import axios from 'axios';
import { notifyAdmin } from './notification.service.js';

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
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long', // Usamos el nombre del mes para evitar ambigüedad (04/05 vs 05/04)
    year: 'numeric',
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

  return `${dayOfWeek}, ${dateParts.day} de ${dateParts.month} de ${dateParts.year} a las ${dateParts.hour}:${dateParts.minute}`;
};

/**
 * Dispara el análisis del resumen del pedido que tipeó el administrador.
 * Se llama cuando se detecta "Entonces te agendo:" o "Modifico tu pedido:".
 * @param {string} contactJid - El ID del contacto del chat.
 * @param {string} orderSummaryText - El texto exacto que escribió el admin.
 * @param {string} action - 'create' o 'replace'. Define cómo se enviará al ERP.
 */
export const triggerOrderAnalysis = async (contactJid, orderSummaryText, action = 'create') => {
  try {
    const currentDateTime = getCurrentFormattedDateTime();

    // Obtenemos un historial más amplio y lo filtramos por tiempo (últimas 12 horas)
    const { messages: recentMessages } = await getRecentMessages(contactJid, 50);
    const timeLimit = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const filteredMessages = recentMessages.filter(msg => new Date(msg.timestamp) >= timeLimit);
    const historyText = formatMessagesForPrompt(filteredMessages);

    // Enviamos a la IA el pedido estructurado y el historial para validar que coincidan
    const formattedPrompt = `Contexto Adicional:\n- Fecha y hora actual del sistema: ${currentDateTime}\n\n--- Historial Reciente ---\n${historyText}\n\n--- Texto del Pedido ---\n${orderSummaryText}`;

    console.log(`[order.service] Enviando historial y pedido a IA para análisis y auditoría.`);
    const analysisResult = await queryIAService('/analyze-order', formattedPrompt);

    if (analysisResult && analysisResult.pedido_detectado) {
      // Verificamos si la IA detectó una discrepancia
      if (analysisResult.discrepancia && analysisResult.discrepancia.detectada) {
        console.warn(`[order.service] DISCREPANCIA DETECTADA: ${analysisResult.discrepancia.motivo}`);

        const notifyMsg = `⚠️ *ALERTA DE DISCREPANCIA*\n\nIntentaste agendar un pedido, pero noté un error:\n_${analysisResult.discrepancia.motivo}_\n\nPor favor, verifica el historial del cliente y vuelve a enviar el comando corregido.`;
        await notifyAdmin(notifyMsg);

        return; // Detenemos el flujo, no creamos ni reemplazamos el pedido
      }

      console.log(`[order.service] Pedido detectado sin discrepancias. Acción destinada: ${action}...`);
      const newOrder = {
        remoteJid: contactJid,
        ...analysisResult
      };

      if (action === 'create') {
        await createOrder(newOrder);
      } else if (action === 'replace') {
        await replaceOrder(newOrder);
      }

    } else {
      console.warn("[order.service] El servicio de IA no detectó un pedido formal.");
    }
  } catch (error) {
    console.error('[order.service] Error en el análisis de pedido:', error);
  }
};

/**
 * Reemplaza un pedido pendiente existente directo en ERPNext a través del microservicio.
 * @param {Object} orderData - Los datos del nuevo pedido extraído.
 */
export const replaceOrder = async (orderData) => {
  try {
    const contactName = await getChatByJid(orderData.remoteJid);

    const payload = {
      remoteJid: orderData.remoteJid,
      contactName: contactName || "Desconocido",
      fecha_hora_entrega: orderData.fecha_hora_entrega,
      productos: orderData.productos,
      //monto_total: parseInt(orderData.monto_total) || 0
    };

    const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://localhost:8001';
    console.log(`[order.service] Solicitando REEMPLAZO de pedido al ERP en ${erpServiceUrl}`);

    const response = await axios.post(`${erpServiceUrl}/api/orders/replace_latest`, payload);

    if (response.data && response.data.success) {
      const { order_name, cancelled_order } = response.data;
      console.log(`[order.service] Reemplazo listo. Vieja: ${cancelled_order}, Nueva: ${order_name}`);

      // Actualizar estado semántico
      await updateChatAnalysis(orderData.remoteJid, 'Pedido Modificado');

      // Notificar al admin por WhatsApp
      const notifyMsg = `♻️ Pedido MODIFICADO en ERPNext\n📋 Orden nueva: ${order_name}\n❌ Orden cancelada: ${cancelled_order || 'ninguna'}\n👤 Cliente: ${payload.contactName}`;
      await notifyAdmin(notifyMsg);
    }

    return response.data;
  } catch (error) {
    console.error('[order.service] Error al reemplazar el pedido en ERPNext:', error.response?.data || error.message);
    return null;
  }
};


/**
 * Crea un nuevo pedido directo en ERPNext a través del microservicio.
 * @param {Object} orderData - Los datos del pedido extraídos por la IA.
 */
export const createOrder = async (orderData) => {
  try {
    // Buscamos el nombre del contacto asociado a este JID.
    const contactName = await getChatByJid(orderData.remoteJid);

    // Mantenemos la fecha tal cual la extrajo la IA en formato ISO string
    const payload = {
      remoteJid: orderData.remoteJid,
      contactName: contactName || "Desconocido",
      fecha_hora_entrega: orderData.fecha_hora_entrega,
      productos: orderData.productos,
    };

    const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://localhost:8001';
    console.log(`[order.service] Enviando pedido a ERP Service en ${erpServiceUrl}`);

    const response = await axios.post(`${erpServiceUrl}/api/orders`, payload);

    if (response.data && response.data.success) {
      const orderName = response.data.order_name;
      console.log(`[order.service] Pedido creado en ERPNext con ID: ${orderName}`);

      // Actualizar el estado de la conversación
      await updateChatAnalysis(orderData.remoteJid, 'Pedido Creado');
      console.log(`[order.service] Estado de conversación para ${orderData.remoteJid} actualizado a 'Pedido Creado'.`);

      // Notificar al admin por WhatsApp
      const notifyMsg = `✅ Pedido creado en ERPNext\n📋 Orden: ${orderName}\n👤 Cliente: ${payload.contactName}`;
      await notifyAdmin(notifyMsg);
    }

    return response.data;
  } catch (error) {
    console.error('[order.service] Error al crear el pedido en ERPNext:', error.response?.data || error.message);
    return null;
  }
};
