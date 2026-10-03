import { getRecentMessages, updateChatAnalysis, getChatByJid } from './mongo.service.js';
import { queryIAService } from './ia.service.js';
import axios from 'axios';
import { sendClientMessage, notifyAdmin } from './notification.service.js';

const CATALOG_NAMES = {
  zero: 'Coca Zero 2 lts',
  deli: 'Delivery',
  capre: 'Canastita Capresse',
  empaJYQ: 'Empanadita de Jamon y Queso',
  empaPollo: 'Empanadita de Pollo',
  milaPollo: 'Milanesa de Pollo',
  pizeta: 'Pizeta',
  mini: 'Mini Burger',
  empaCarne: 'Empanadita de Carne',
  sandwPollo: 'Sandwich de Mila de Pollo',
  milaCarne: 'Milanesita de Carne',
  pre: 'Combo Premium',
  sprite: 'Sprite 2lts',
  coca3: 'Coca 3 lts',
  clasico: 'Combo Clasico',
  fuga: 'Canastita Fugazeta',
  sandJYQ: 'Sandw Jamon y Queso',
  napo: 'Canastita Napolitana',
  croq: 'Croquetas',
  guara: 'Fanta Guarana 2lts',
  extra: 'Extra',
  naranja: 'Fanta Naranja 2lts',
  coca2: 'Coca 2lts',
  mbeju: 'Mbeju',
  payagua: 'Payagua',
  soo: "Chipa So'o",
  mandio: 'Pastel Mandio'
};

/**
 * Formatea una fecha de entrega en un texto legible y cálido para el cliente.
 * @param {string} dateStr - Fecha en formato ISO o YYYY-MM-DD HH:MM:SS.
 * @returns {string} - Fecha formateada.
 */
const formatDeliveryDateFriendly = (dateStr) => {
  if (!dateStr) return 'A coordinar';
  try {
    const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + '-03:00';
    const d = new Date(iso);
    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Etc/GMT+3'
    };
    const parts = new Intl.DateTimeFormat('es-ES', options).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    const dayName = parts.weekday.charAt(0).toUpperCase() + parts.weekday.slice(1);
    return `${dayName}, ${parts.day} de ${parts.month} a las ${parts.hour}:${parts.minute} hs.`;
  } catch (e) {
    return dateStr;
  }
};

/**
 * Construye el mensaje de confirmación amigable para enviar al cliente.
 */
const buildClientConfirmationMessage = ({ orderName, contactName, deliveryDate, productos, total, isModification }) => {
  const greeting = isModification ? '🤖 *¡Pedido Modificado!* ✍️' : '🤖 *¡Pedido Confirmado!* 🎉';
  const nameText = contactName && contactName !== 'Desconocido' ? `*${contactName}*` : '';
  const intro = isModification
    ? `¡Hola${nameText ? ` ${nameText}` : ''}! Hemos actualizado tu pedido en nuestro sistema.`
    : `¡Hola${nameText ? ` ${nameText}` : ''}! Tu pedido ha sido agendado exitosamente en el sistema.`;

  const productLines = (productos || []).map(p => {
    if (p.item_code === 'deli') {
      const deliveryCost = Math.round((Number(p.cantidad) || 1) * 5000);
      return `• Delivery: ₲ ${deliveryCost.toLocaleString('es-PY')}`;
    }
    const name = CATALOG_NAMES[p.item_code] || p.item_code;
    if ((p.item_code === 'pre' || p.item_code === 'clasico') && p.cantidad % 1 !== 0) {
      const units = Math.round(Number(p.cantidad) * 100);
      return `• ${p.cantidad} ${name} (${units} unidades)`;
    }
    return `• ${p.cantidad} ${name}`;
  }).join('\n');

  const formattedTotal = total ? `₲ ${Math.round(Number(total)).toLocaleString('es-PY')}` : 'A calcular';
  const formattedDate = formatDeliveryDateFriendly(deliveryDate);

  return `${greeting}
${intro}

📋 *N° de Pedido:* \`${orderName}\`
🕒 *Entrega programada:* ${formattedDate}

📦 *Detalle del Pedido:*
${productLines}

💰 *Total a abonar:* ${formattedTotal}

¡Muchas gracias por elegir Voraz! ✨ Si deseas realizar algún cambio o consulta, avísanos.`;
};

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
  const timeZone = 'Etc/GMT+3';

  const options = {
    weekday: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
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
      // Si la IA detecta discrepancia, se alerta al admin para auditoría pero se continúa con la creación
      if (analysisResult.discrepancia && analysisResult.discrepancia.detectada) {
        console.warn(`[order.service] DISCREPANCIA DETECTADA (se procede a agendar igual): ${analysisResult.discrepancia.motivo}`);

        const notifyMsg = `⚠️ *DISCREPANCIA AUDITADA (Pedido agendado igual)*\n\nMotivo detectado:\n_${analysisResult.discrepancia.motivo}_\n\nEl pedido se generó en ERPNext y se confirmó al cliente. Revisa si necesitas realizar ajustes con /modificar.`;
        await notifyAdmin(notifyMsg);
      }

      console.log(`[order.service] Pedido detectado. Acción destinada: ${action}...`);
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
    };

    const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://localhost:8001';
    console.log(`[order.service] Solicitando REEMPLAZO de pedido al ERP en ${erpServiceUrl}`);

    const response = await axios.post(`${erpServiceUrl}/api/orders/replace_latest`, payload);

    if (response.data && response.data.success) {
      const { order_name, grand_total, cancelled_order } = response.data;
      console.log(`[order.service] Reemplazo listo. Vieja: ${cancelled_order}, Nueva: ${order_name}`);

      // Actualizar estado semántico
      await updateChatAnalysis(orderData.remoteJid, 'Pedido Modificado');

      // Enviar confirmación directamente al cliente
      const clientMsg = buildClientConfirmationMessage({
        orderName: order_name,
        contactName: payload.contactName,
        deliveryDate: orderData.fecha_hora_entrega,
        productos: orderData.productos,
        total: grand_total,
        isModification: true
      });
      await sendClientMessage(orderData.remoteJid, clientMsg);
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
      const { order_name, grand_total } = response.data;
      console.log(`[order.service] Pedido creado en ERPNext con ID: ${order_name}, Total: ${grand_total}`);

      // Actualizar el estado de la conversación
      await updateChatAnalysis(orderData.remoteJid, 'Pedido Creado');
      console.log(`[order.service] Estado de conversación para ${orderData.remoteJid} actualizado a 'Pedido Creado'.`);

      // Enviar confirmación directamente al cliente
      const clientMsg = buildClientConfirmationMessage({
        orderName: order_name,
        contactName: payload.contactName,
        deliveryDate: orderData.fecha_hora_entrega,
        productos: orderData.productos,
        total: grand_total,
        isModification: false
      });
      await sendClientMessage(orderData.remoteJid, clientMsg);
    }

    return response.data;
  } catch (error) {
    console.error('[order.service] Error al crear el pedido en ERPNext:', error.response?.data || error.message);
    return null;
  }
};
