// routes/messages.routes.js
import { Router } from 'express';
import { saveMessage } from '../services/mongo.service.js';
import { handleAdminCommand } from '../services/command.handler.js';
import { processMessage } from '../services/message.processor.js';

const router = Router();

// Endpoint que recibe los mensajes de los clientes.
router.post('/messages', async (req, res) => {
  const messageData = req.body.message;

  if (!messageData) {
    console.warn("[Router /messages] Petición recibida sin cuerpo de mensaje.");
    return res.status(400).send('Cuerpo del mensaje requerido.');
  }
 
  // 1. Guardar el mensaje en la DB inmediatamente.
  await saveMessage(messageData);
  
  // 2. Delegar toda la lógica de procesamiento al Message Processor.
  await processMessage(messageData);
  
  res.sendStatus(200);
});

// --- Lógica para el endpoint de administradores ---
router.post('/whatsapp-inbound', async (req, res) => {
    console.log('[Router /whatsapp-inbound] Cuerpo de la petición recibido:', JSON.stringify(req.body, null, 2));
    const adminMessageData = req.body;

    let messageContent = '';

    // Lógica para manejar ambos formatos de payload
    if (typeof adminMessageData.message === 'string') {
        // Formato de WABI en producción: { "message": "/listado" }
        messageContent = adminMessageData.message;
    } else if (typeof adminMessageData.message?.text?.body === 'string') {
        // Formato del simulador local: { "message": { "text": { "body": "/listado" } } }
        messageContent = adminMessageData.message.text.body;
    }

    if (!messageContent) {
        console.warn("[Router /whatsapp-inbound] No se pudo extraer el contenido del mensaje.");
        return res.status(400).send('Formato de mensaje de admin incorrecto.');
    }
    
    let replyMessage = null;
    if (messageContent.startsWith('/')) {
      replyMessage = await handleAdminCommand(messageContent);
    }

    if (replyMessage) {
      console.log(`[Router /whatsapp-inbound] Enviando respuesta: "${replyMessage.substring(0, 50)}..."`);
      res.json({ reply: replyMessage });
    } else {
      res.sendStatus(200);
    }
})

export default router;
