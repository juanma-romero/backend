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
    // Se define 'adminMessageData' para este scope, no 'messageData'
    const adminMessageData = req.body;
  
    if (!adminMessageData?.message?.text?.body) {
      console.warn("[Router /whatsapp-inbound] Se recibió una petición sin el formato esperado.");
      return res.status(400).send('Formato de mensaje de admin incorrecto.');
    }
    
    // 2. Lógica de negocio (delegada al command handler)
    const messageContent = adminMessageData.message.text.body || '';
    if (messageContent.startsWith('/')) { // Asumimos que todos los comandos empiezan con /
      await handleAdminCommand(messageContent);
    }

    res.sendStatus(200);
})

export default router;
