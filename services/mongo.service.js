// Nota: Necesitaríamos pasar la 'collection' a este servicio,
// o inicializarla aquí. Lo haremos simple por ahora.
let collection;

export const setCollection = (dbCollection) => {
    collection = dbCollection;
};

// Esta función es la única que sabe cómo guardar un mensaje.
export const saveMessage = async (messageData) => {
    if (!collection) {
        console.error("[mongo.service] La colección no está inicializada.");
        return;
    }
  try {
    const remoteJid = messageData.key.remoteJid
    // Aquí formateamos el mensaje para guardarlo en la colección
    const formattedMessage = {
      id: messageData.key.id,
      role: messageData.key.fromMe ? 'assistant' : 'user',
      type: messageData.type,
      content: messageData.content || null,
      caption: messageData.caption || null,
      mediaUrl: messageData.mediaUrl || null,
      contactInfo: messageData.contactInfo || null,
      quotedMessage: messageData.quotedMessage || null,
      timestamp: messageData.messageTimestamp ? new Date(messageData.messageTimestamp * 1000) : new Date()
    }
    
    // Aquí buscamos el chat actual para determinar el estado de la conversación
    const currentChat = await collection.findOne({ contactJid: remoteJid });
    let updatedStateConversation = 'No leido';
    if (currentChat && currentChat.stateConversation === 'Resuelto') {
      updatedStateConversation = 'No leido';
    } else if (currentChat) {
      updatedStateConversation = currentChat.stateConversation;
    }
    // Aquí definimos la operación de actualización
    const updateOperation = { $push: { messages: formattedMessage },
      $set: {
        stateConversation: updatedStateConversation,
        updatedAt: new Date()
      },
      $setOnInsert: {
        contactJid: remoteJid,
        createdAt: new Date()
      }};

    await collection.findOneAndUpdate(
        { contactJid: remoteJid },
        updateOperation,
        { upsert: true }
    );
    console.log(`[mongo.service] Mensaje guardado para ${remoteJid}`);
  } catch (err) {
    console.error('[mongo.service] Error al guardar el mensaje:', err);
  }
}