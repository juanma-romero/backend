// services/mongo.service.js
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
    if (!messageData || !messageData.key || !messageData.key.remoteJid) {
        console.error("[mongo.service] Datos del mensaje incompletos para guardar.", messageData);
        return;
    }

    try {
        const remoteJid = messageData.key.remoteJid;

        // Lógica de formato de mensaje (extraída del index.js original)
        const formattedMessage = {
            id: messageData.key.id,
            role: messageData.key.fromMe ? 'assistant' : 'user',
            type: messageData.type,
            content: messageData.content || null,
            caption: messageData.caption || null,
            mediaUrl: messageData.mediaUrl || null,
            contactInfo: messageData.contactInfo || null,
            quotedMessage: messageData.quotedMessage || null,
            // Aseguramos que el timestamp sea un objeto Date válido
            timestamp: messageData.messageTimestamp ? new Date(parseInt(messageData.messageTimestamp, 10) * 1000) : new Date()
        };

        // Lógica para determinar el estado de la conversación
        const currentChat = await collection.findOne({ contactJid: remoteJid });
        let updatedStateConversation = 'No leido';
        if (currentChat && currentChat.stateConversation === 'Resuelto') {
            updatedStateConversation = 'No leido';
        } else if (currentChat) {
            updatedStateConversation = currentChat.stateConversation;
        }

        // Lógica de actualización de la base de datos
        const updateOperation = {
            $push: { messages: formattedMessage },
            $set: {
                stateConversation: updatedStateConversation,
                updatedAt: new Date()
            },
            $setOnInsert: {
                contactJid: remoteJid,
                createdAt: new Date()
            }
        };

        if (!messageData.key.fromMe && messageData.pushName) {
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
}