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
 * La lógica de estado ha sido removida de aquí, será manejada por el servicio de análisis.
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

        const formattedMessage = {
            id: messageData.key.id,
            role: messageData.key.fromMe ? 'assistant' : 'user', // 'assistant' es el admin, 'user' es el cliente
            type: messageData.type || 'text',
            content: messageData.content || messageData.caption || null,
            timestamp: messageData.messageTimestamp ? new Date(messageData.messageTimestamp ) : new Date()
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
        if (messageData.pushName) {
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
 * Obtiene los últimos N mensajes de una conversación.
 * @param {string} contactJid - El JID del contacto.
 * @param {number} limit - El número de mensajes a obtener.
 * @returns {Promise<Array>} - Una promesa que resuelve a un array de mensajes.
 */
export const getRecentMessages = async (contactJid, limit = 10) => {
    if (!collection) return [];
    try {
        const chat = await collection.findOne(
            { contactJid: contactJid },
            { projection: { messages: { $slice: -limit } } }
        );
        return chat ? chat.messages : [];
    } catch (err) {
        console.error('[mongo.service] Error al obtener mensajes recientes:', err);
        return [];
    }
};

/**
 * Actualiza un chat con el estado y resumen provistos por la IA.
 * @param {string} contactJid - El JID del contacto.
 * @param {string} state - El nuevo estado de la conversación.
 * @param {string} summary - El nuevo resumen contextual.
 */
export const updateChatAnalysis = async (contactJid, state, summary) => {
    if (!collection) return;
    try {
        await collection.updateOne(
            { contactJid: contactJid },
            { 
                $set: { 
                    stateConversation: state,
                    contextualSummary: summary, // Este es el nuevo campo para el resumen
                    updatedAt: new Date() 
                } 
            }
        );
        console.log(`[mongo.service] Análisis guardado para ${contactJid}. Estado: ${state}`);
    } catch (err) {
        console.error('[mongo.service] Error al guardar el análisis del chat:', err);
    }
};

/**
 * Guarda un documento de pedido en la colección 'pedidos'.
 * @param {Object} orderDocument - El documento del pedido a guardar.
 * @returns {Promise<Object>} - El documento guardado.
 */
export const saveOrderToDb = async (orderDocument) => {
  if (!dbClient) {
    console.error("[mongo.service] Conexión a DB no disponible.");
    return null;
  }
  try {
    const pedidosCollection = dbClient.db().collection('pedidos');
    const result = await pedidosCollection.insertOne(orderDocument);
    return { _id: result.insertedId, ...orderDocument };
  } catch (error) {
    console.error('[mongo.service] Error al guardar el pedido:', error);
    throw error;
  }
};

/**
 * Obtiene todos los pedidos de la colección 'pedidos'.
 * @returns {Promise<Array>} - Un array con todos los pedidos.
 */
export const getAllOrders = async () => {
  if (!dbClient) {
    console.error("[mongo.service] Conexión a DB no disponible.");
    return [];
  }
  try {
    const pedidosCollection = dbClient.db().collection('pedidos');
    const orders = await pedidosCollection.find({}).toArray();
    return orders;
  } catch (error) {
    console.error('[mongo.service] Error al obtener los pedidos:', error);
    return [];
  }
};
