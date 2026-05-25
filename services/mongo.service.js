// services/mongo.service.js
let collection;
let dbClient;

export const setCollection = (dbCollection) => {
  collection = dbCollection;
};

export const setDbClient = (client) => {
  dbClient = client;
};

/**
 * Guarda un mensaje en la conversación correcta. 
 */
export const saveMessage = async (messageData) => {
  if (!collection) {
    console.error("[mongo.service] La colección no está inicializada.");
    return;
  }
  if (!messageData || !messageData.key || !messageData.key.remoteJid) {
    console.error("[mongo.service] Datos del mensaje incompletos para guardar.", messageData);
    return;
  }

  try {
    const remoteJid = messageData.key.remoteJid;

    let msgTimestamp = new Date();
    if (messageData.messageTimestamp) {
      msgTimestamp = (typeof messageData.messageTimestamp === 'number' && messageData.messageTimestamp < 10000000000)
        ? new Date(messageData.messageTimestamp * 1000)
        : new Date(messageData.messageTimestamp);
    }

    const formattedMessage = {
      id: messageData.key.id,
      role: messageData.key.fromMe ? 'assistant' : 'user', // 'assistant' es el admin, 'user' es el cliente
      type: messageData.type || 'text',
      content: messageData.textContent || '',
      timestamp: msgTimestamp
    };

    const updateOperation = {
      $push: { messages: formattedMessage },
      $set: { updatedAt: new Date() },
      $setOnInsert: {
        contactJid: remoteJid,
        stateConversation: 'Sin Contestar', // Estado inicial por defecto para un chat nuevo
        contextualSummary: 'Nuevo chat esperando primera respuesta.', // Resumen inicial
        createdAt: new Date()
      }
    };

    // Actualiza el nombre del contacto si viene en el mensaje
    if (messageData.pushName && messageData.key.fromMe === false) {
      updateOperation.$set.contactName = messageData.pushName;
    }

    await collection.findOneAndUpdate(
      { contactJid: remoteJid },
      updateOperation,
      { upsert: true }
    );
    console.log(`[mongo.service] Mensaje guardado para ${remoteJid}`);
  } catch (err) {
    console.error('[mongo.service] Error al guardar el mensaje:', err);
  }
};

/**
 * Obtiene los últimos N mensajes de una conversación junto con el nombre del contacto.
 * @param {string} contactJid - El JID del contacto.
 * @param {number} limit - El número de mensajes a obtener.
 * @returns {Promise<Object>} - Una promesa que resuelve a un objeto con messages (array) y contactName (string).
 */
export const getRecentMessages = async (contactJid, limit = 10) => {
  if (!collection) return { messages: [], contactName: null };
  try {
    const chat = await collection.findOne(
      { contactJid: contactJid },
      { projection: { messages: { $slice: -limit }, contactName: 1 } }
    );
    return chat ? { messages: chat.messages, contactName: chat.contactName } : { messages: [], contactName: null };
  } catch (err) {
    console.error('[mongo.service] Error al obtener mensajes recientes:', err);
    return { messages: [], contactName: null };
  }
};

/**
 * Actualiza un chat con el estado y resumen provistos por la IA.
 * @param {string} contactJid - El JID del contacto.
 * @param {string} state - El nuevo estado de la conversación.
 * @param {string} [summary] - El nuevo resumen contextual (opcional).
 */
export const updateChatAnalysis = async (contactJid, state, summary) => {
  if (!collection) return;
  try {
    const updateFields = {
      stateConversation: state,
      updatedAt: new Date()
    };

    // Solo actualiza el resumen si se proporciona uno.
    if (summary) {
      updateFields.contextualSummary = summary;
    }

    await collection.updateOne(
      { contactJid: contactJid },
      { $set: updateFields }
    );
    console.log(`[mongo.service] Análisis guardado para ${contactJid}. Estado: ${state}`);
  } catch (err) {
    console.error('[mongo.service] Error al guardar el análisis del chat:', err);
  }
};

/**
 * Obtiene los chats que están pendientes de respuesta por parte del administrador.
 * @returns {Promise<Array>} - Un array con los chats pendientes.
 */
export const getPendingChats = async () => {
  if (!collection) return [];
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pendingChats = await collection.find({
      stateConversation: { $in: ['Requiere Acción del Admin', 'Sin Contestar'] },
      updatedAt: { $gte: fortyEightHoursAgo }
    }).toArray();
    return pendingChats;
  } catch (err) {
    console.error('[mongo.service] Error al obtener chats pendientes:', err);
    return [];
  }
};

/**
 * Obtiene contactName de chat por su JID.
 * @param {string} contactJid - El JID del contacto.
 * @returns {Promise<Object|null>} - El documento del chat o null si no se encuentra.
 */
export const getChatByJid = async (contactJid) => {
  if (!collection) {
    console.error("[mongo.service] La colección no está inicializada para getChatByJid.");
    return null;
  }
  try {
    // Usamos una proyección para obtener solo el campo contactName y ser más eficientes.
    const chat = await collection.findOne(
      { contactJid: contactJid },
      { projection: { contactName: 1, _id: 0 } } // Solo queremos el nombre
    );
    return chat ? chat.contactName : null;
  } catch (err) {
    console.error('[mongo.service] Error al obtener el chat por JID:', err);
    return null;
  }
};
