// services/pending_orders.service.js
import { connectToDatabase } from '../db.js';
import { createOrder, replaceOrder } from './order.service.js';
import { queryIAService } from './ia.service.js';
import { notifyAdmin } from './notification.service.js';

let pendingCollection = null;

const getPendingCollection = async () => {
  if (!pendingCollection) {
    const { db } = await connectToDatabase();
    pendingCollection = db.collection('pending_orders');
    // TTL index: los documentos se borran solos si superan 48h tras expireAt por limpieza
    await pendingCollection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    await pendingCollection.createIndex({ contactJid: 1, status: 1 }).catch(() => {});
  }
  return pendingCollection;
};

/**
 * Guarda o actualiza un pedido en pending_orders en estado 'pending_confirmation'
 * con expiración a 4 horas a partir de su creación/actualización.
 */
export const savePendingOrder = async (orderData, action = 'create') => {
  const col = await getPendingCollection();
  const now = new Date();
  const expireAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 horas

  const doc = {
    contactJid: orderData.remoteJid,
    status: 'pending_confirmation',
    action: action, // 'create' o 'replace'
    orderData: orderData,
    createdAt: now,
    updatedAt: now,
    expireAt: expireAt,
    expirationNotified: false
  };

  // Si ya existía uno pendiente para este cliente, lo reemplazamos
  await col.updateOne(
    { contactJid: orderData.remoteJid, status: 'pending_confirmation' },
    { $set: doc },
    { upsert: true }
  );

  console.log(`[pending_orders.service] Pedido pendiente guardado para ${orderData.remoteJid}. Vence: ${expireAt.toISOString()}`);
  return doc;
};

/**
 * Obtiene el pedido pendiente activo para un contactJid (si no ha expirado)
 */
export const getActivePendingOrder = async (contactJid) => {
  const col = await getPendingCollection();
  const now = new Date();
  const pending = await col.findOne({
    contactJid: contactJid,
    status: 'pending_confirmation',
    expireAt: { $gt: now }
  });
  return pending;
};

/**
 * Clasifica la respuesta del cliente usando el endpoint /classify-order-intent de IA.
 */
export const classifyClientResponse = async (clientMessageText, orderSummaryText = '') => {
  const prompt = `Propuesta realizada por el negocio:
${orderSummaryText || 'Entonces te agendo el pedido solicitado.'}

Respuesta reciente del cliente:
"${clientMessageText}"`;
  const res = await queryIAService('/classify-order-intent', prompt);
  return res || { intent: 'OTRO', confianza: 0, motivo: 'Sin respuesta del servicio IA' };
};

/**
 * Maneja la respuesta de un cliente cuando tiene un pedido pendiente.
 * Devuelve true si el mensaje fue manejado como parte del ciclo del pedido pendiente.
 */
export const handleClientResponseForPendingOrder = async (messageData) => {
  const contactJid = messageData.key.remoteJid;
  const textContent = messageData.textContent || '';

  const pending = await getActivePendingOrder(contactJid);
  if (!pending) {
    return false; // No hay pedido pendiente activo para este cliente
  }

  console.log(`[pending_orders.service] Mensaje entrante de ${contactJid} con pedido pendiente detectado. Analizando intención...`);

  const classification = await classifyClientResponse(textContent);
  console.log(`[pending_orders.service] Intención detectada: ${classification.intent} (confianza: ${classification.confianza}) - ${classification.motivo}`);

  const col = await getPendingCollection();

  switch (classification.intent) {
    case 'CONFIRMAR': {
      console.log(`[pending_orders.service] Pedido confirmado por el cliente. Creando en ERPNext...`);
      
      // Marcamos como confirmed antes de llamar para evitar doble ejecución si llegan mensajes rápidos
      await col.updateOne(
        { _id: pending._id },
        { $set: { status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() } }
      );

      if (pending.action === 'replace') {
        await replaceOrder(pending.orderData);
      } else {
        await createOrder(pending.orderData);
      }
      return true;
    }

    case 'MODIFICAR': {
      console.log(`[pending_orders.service] Cliente solicitó modificaciones: "${textContent}"`);
      await col.updateOne(
        { _id: pending._id },
        { 
          $set: { status: 'modification_requested', updatedAt: new Date() },
          $push: { notes: { date: new Date(), text: textContent } }
        }
      );
      await notifyAdmin(
        `✏️ *El cliente quiere modificar el pedido pendiente:*\n\n👤 *Cliente:* ${pending.orderData.contactName || contactJid}\n💬 *Mensaje:* "${textContent}"\n\nEl pedido aún no fue creado en ERPNext. Ajusta con "Entonces te agendo:..." o responde al cliente.`
      );
      return true;
    }

    case 'PEDIR_TIEMPO': {
      console.log(`[pending_orders.service] Cliente pide tiempo para confirmar: "${textContent}"`);
      await col.updateOne(
        { _id: pending._id },
        { 
          $set: { updatedAt: new Date() },
          $push: { notes: { date: new Date(), text: textContent } }
        }
      );
      // No creamos pedido ni alertamos alarma urgente, queda a la espera dentro de las 4 horas.
      return true;
    }

    case 'OTRO':
    default: {
      // Mensaje que no es una confirmación ni modificación directa.
      // Lo dejamos pendiente y permitimos que el flujo continúe normal (por si hace una consulta)
      return false;
    }
  }
};

/**
 * Revisa pedidos pendientes vencidos (> 4 horas sin confirmar) y notifica al admin.
 */
export const checkExpiredPendingOrders = async () => {
  const col = await getPendingCollection();
  const now = new Date();

  const expiredOrders = await col.find({
    status: 'pending_confirmation',
    expireAt: { $lte: now },
    expirationNotified: false
  }).toArray();

  for (const order of expiredOrders) {
    console.log(`[pending_orders.service] Pedido pendiente expirado para ${order.contactJid}`);
    
    await col.updateOne(
      { _id: order._id },
      { $set: { status: 'expired', expirationNotified: true, updatedAt: now } }
    );

    const contactName = order.orderData?.contactName || order.contactJid;
    await notifyAdmin(
      `⏰ *Pedido Pendiente Expirado (4 horas sin confirmar)*\n\n👤 *Cliente:* ${contactName}\nEl pedido preliminar que agendaste no recibió confirmación y ha sido cancelado automáticamente del borrador.`
    );
  }
};
