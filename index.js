import express from 'express';
import http from 'http';
import { connectToDatabase } from './db.js';
import axios from 'axios'

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// NUEVO: Obtenemos la URL del servicio de IA desde las variables de entorno
// El fallback es para desarrollo local si no usas Docker.
const IA_SERVICE_URL = process.env.IA_SERVICE_URL || 'http://localhost:8000';

let collection;

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

// NUEVO: Función reutilizable para llamar al servicio de IA
const queryIAService = async (prompt) => {
  try {
    console.log(`[Backend] Enviando prompt a IA Service: "${prompt}" en la URL: ${IA_SERVICE_URL}/ask-google-ai`);
    const response = await axios.post(`${IA_SERVICE_URL}/ask-google-ai`, {
      prompt: prompt
    });
    console.log('[Backend] Respuesta recibida de IA Service:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('[Backend] Error al llamar a IA Service:', error.response.data);
    } else {
      console.error('[Backend] Error de conexión con IA Service:', error.message);
    }
    return null;
  }
};


app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message;

  if (!messageData || !messageData.key || !messageData.key.remoteJid || !messageData.key.id) {
    console.error("Datos del mensaje incompletos o inválidos recibidos en /api/messages:", messageData);
    return res.status(400).send('Datos del mensaje incompletos o inválidos.');
  }

  // --- NUEVO: Lógica para detectar el comando y llamar a la IA ---
  const messageContent = messageData.content || '';
  if (messageContent === '/listado') {
    console.log(`[Backend] Comando '/listado' detectado del cliente ${messageData.key.remoteJid}.`);
    
    // Hacemos la consulta a nuestro servicio de IA
    const iaResponse = await queryIAService('¿Cuántos días tiene un año bisiesto?');
    
    if (iaResponse && iaResponse.answer) {
      console.log(`[Backend] Respuesta final de la IA: ${iaResponse.answer}`);
      // Aquí podrías, en el futuro, enviar la respuesta de vuelta por WhatsApp.
      // Por ahora, solo la mostramos en la consola del backend.
    } else {
      console.log('[Backend] No se pudo obtener una respuesta del servicio de IA.');
    }
    
    // Enviamos una respuesta 200 para que el webhook no quede esperando y paramos la ejecución aquí.
    return res.sendStatus(200);
  }
  // --- FIN DE LA NUEVA LÓGICA ---


  // El resto del código para guardar el mensaje sigue igual...
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
      timestamp: messageData.messageTimestamp ? new Date(messageData.messageTimestamp * 1000) : new Date()
    };

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
    };

    if (!messageData.key.fromMe) {
      updateOperation.$set.contactName = messageData.pushName;
    }

    await collection.findOneAndUpdate({ contactJid: remoteJid }, updateOperation, {
      upsert: true,
      returnDocument: 'after'
    });
    res.sendStatus(200);

  } catch (err) {
    console.error('Error procesando el mensaje en MongoDB para /api/messages:', err);
    res.status(500).send('Error al procesar el mensaje');
  }
});


app.post('/api/whatsapp-inbound', async (req, res) => { // NUEVO: Convertido a async
  console.log('[BACKEND] Mensaje recibido en /api/whatsapp-inbound. Body completo:', JSON.stringify(req.body, null, 2));
 
  // --- NUEVO: Lógica para detectar el comando y llamar a la IA ---
  // Asumimos que el mensaje está en req.body.message
  const messageContent = req.body.message || '';
  if (messageContent.trim().toLowerCase() === '/listado') {
    console.log(`[Backend] Comando '/listado' detectado de TI (admin).`);
    
    // Hacemos la consulta a nuestro servicio de IA
    const iaResponse = await queryIAService('¿Cuántos días tiene un año bisiesto?');
    
    if (iaResponse && iaResponse.answer) {
      console.log(`[Backend] Respuesta final de la IA: ${iaResponse.answer}`);
    } else {
      console.log('[Backend] No se pudo obtener una respuesta del servicio de IA.');
    }
  }
  // --- FIN DE LA NUEVA LÓGICA ---
   
  res.sendStatus(200);
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
