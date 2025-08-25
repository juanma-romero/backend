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
    const adminMessageData = req.body;
  
    if (!adminMessageData?.message?.text?.body) {
      console.warn("[Router /whatsapp-inbound] Se recibió una petición sin el formato esperado.");
      return res.status(400).send('Formato de mensaje de admin incorrecto.');
    }
    
    const messageContent = adminMessageData.message.text.body || '';
    let replyMessage = null;

    if (messageContent.startsWith('/')) {
      replyMessage = await handleAdminCommand(messageContent);
    }

    // Si el manejador de comandos devolvió un mensaje, lo enviamos como respuesta.
    if (replyMessage) {
      console.log(`[Router /whatsapp-inbound] Enviando respuesta: "${replyMessage.substring(0, 50)}..."`);
      res.json({ reply: replyMessage });
    } else {
      // Si no hay mensaje de respuesta (ej. no era un comando), solo confirmamos la recepción.
      res.sendStatus(200);
    }
})

export default router;
