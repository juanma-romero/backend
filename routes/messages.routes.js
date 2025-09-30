// routes/messages.routes.js
import { Router } from 'express';
import { saveMessage } from '../services/mongo.service.js';
import { handleAdminCommand } from '../services/command.handler.js';
import { processMessage } from '../services/message.processor.js';
import fs from 'fs';
import path from 'path';

// Leer configuración de números de administradores
const adminPhonesPath = path.join(process.cwd(), 'admin-phones.json');
const adminPhones = JSON.parse(fs.readFileSync(adminPhonesPath, 'utf-8'));

// Función para verificar si un número es de administrador
const isAdmin = (remoteJid) => {
  const phoneNumber = remoteJid.split('@')[0];
  return Object.values(adminPhones).includes(phoneNumber);
};

const router = Router();

// Endpoint que recibe los mensajes de clientes y comandos de administradores.
router.post('/messages', async (req, res) => {
  const messageData = req.body.message;

  if (!messageData) {
    console.warn("[Router /messages] Petición recibida sin cuerpo de mensaje.");
    return res.status(400).send('Cuerpo del mensaje requerido.');
  }

  // Verificar si el mensaje proviene de un administrador
  if (isAdmin(messageData.key.remoteJid)) {
    console.log(`[Router /messages] Mensaje de administrador detectado: ${messageData.key.remoteJid}`);

    // Si es un comando (comienza con '/'), procesarlo como comando
    if (messageData.content && messageData.content.startsWith('/')) {
      console.log(`[Router /messages] Procesando comando: ${messageData.content}`);

      try {
        const replyMessage = await handleAdminCommand(messageData.content);

        if (replyMessage) {
          console.log(`[Router /messages] Respuesta del comando: "${replyMessage.substring(0, 50)}..."`);
          // Aquí se podría enviar la respuesta directamente al servidor 'dash'
          // Por ahora retornamos la respuesta para que el servidor 'dash' la maneje
          return res.json({ reply: replyMessage, targetJid: messageData.key.remoteJid });
        } else {
          return res.sendStatus(200);
        }
      } catch (error) {
        console.error('[Router /messages] Error procesando comando de administrador:', error);
        return res.status(500).send('Error procesando comando');
      }
    } else {
      // Mensaje de administrador pero no es comando, ignorar
      console.log(`[Router /messages] Mensaje de administrador ignorado (no es comando): ${messageData.content}`);
      return res.sendStatus(200);
    }
  } else {
    // Mensaje de cliente regular - comportamiento original
    console.log(`[Router /messages] Procesando mensaje de cliente: ${messageData.key.remoteJid}`);

    // 1. Guardar el mensaje en la DB inmediatamente.
    await saveMessage(messageData);

    // 2. Delegar toda la lógica de procesamiento al Message Processor.
    await processMessage(messageData);

    res.sendStatus(200);
  }
});



export default router;
