import express from 'express'
import http from 'http'
import { connectToDatabase } from './db.js';

const app = express()
const server = http.createServer(app)

// Increase the limit for JSON payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let collection

// Inicializar conexión a la base de datos 
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collection = db.collection('chatsV2');
    console.log("Conexión a la base de datos y colección 'chatsV2' inicializada.");
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}
initializeDatabase();

app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message;

  if (!messageData || !messageData.key || !messageData.key.remoteJid || !messageData.key.id) {
    console.error("Datos del mensaje incompletos o inválidos recibidos en /api/messages:", messageData);
    return res.status(400).send('Datos del mensaje incompletos o inválidos para /api/messages.');
  }

  if (messageData.content && messageData.content.toLowerCase() === 'te tomo el pedido') {
    console.log(`[IndexJS - /api/messages] Mensaje clave 'te tomo el pedido' detectado para ${messageData.key.remoteJid}.`);
    
  }

  try {
    const remoteJid = messageData.key.remoteJid;

    const formattedMessage = {
      id: messageData.key.id,
      role: messageData.key.fromMe ? 'assistant' : 'user',
      type: messageData.type,
      content: messageData.content || null,
      caption: messageData.caption || null,
      mediaUrl: messageData.mediaUrl || null,
      contactInfo: messageData.contactInfo || null,
      quotedMessage: messageData.quotedMessage || null,
      timestamp: messageData.messageTimestamp
               ? new Date(messageData.messageTimestamp)
               : new Date()
    }

    const currentChat = await collection.findOne({ contactJid: remoteJid });
    let updatedStateConversation = 'No leido';
    if (currentChat && currentChat.stateConversation === 'Resuelto') {
      updatedStateConversation = 'No leido';
    } else if (currentChat) {
      updatedStateConversation = currentChat.stateConversation;
    }

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
    }

    if (!messageData.key.fromMe) {
      updateOperation.$set.contactName = messageData.pushName;
    }

    await collection.findOneAndUpdate(
      { contactJid: remoteJid },
      updateOperation,
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
    res.sendStatus(200);

  } catch (err) {
    console.error('Error procesando el mensaje en MongoDB para /api/messages:', err);
    res.status(500).send('Error al procesar el mensaje en /api/messages');
  }
})

// *** NUEVO ENDPOINT PARA MENSAJES DE WHATSAPP DESDE 'fresca' (SIMPLIFICADO) ***
app.post('/api/whatsapp-inbound', (req, res) => {
  console.log('[BACKEND] Mensaje recibido en /api/whatsapp-inbound. Body completo:', JSON.stringify(req.body, null, 2));
 
   
  // 3. Devolver la respuesta a 'fresca'
  res.status(200)
})

const port =  3000
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})