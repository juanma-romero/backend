import { Router } from 'express';
import { queryIAService } from '../services/ia.service.js';
import { saveMessage } from '../services/mongo.service.js';

const router = Router();

// Lógica para el endpoint de clientes
router.post('/messages', async (req, res) => {
  const messageData = req.body.message;
  // 1. Guardar el mensaje (delegamos a mongo.service)
  await saveMessage(messageData);

  // 2. Lógica de negocio (detectar comandos)
  const messageContent = messageData.content || '';
  if (messageContent === '/listado') {
    console.log(`[Router] Comando '/listado' detectado.`);
    // 3. Llamar a la IA (delegamos a ia.service)
    const iaResponse = await queryIAService('¿Cuántos días tiene un año bisiesto?');
    console.log('[Router] Respuesta de la IA:', iaResponse?.answer);
    // Aquí podrías usar otro servicio para responder por WhatsApp
  }

  res.sendStatus(200);
});

// Lógica para el endpoint de administradores
router.post('/whatsapp-inbound', async (req, res) => {
    const messageContent = messageData.content || '';
  if (messageContent === '/listado') {
    console.log(`[Router] Comando '/listado' detectado.`);
    // 3. Llamar a la IA (delegamos a ia.service)
    const iaResponse = await queryIAService('¿Cuántos días tiene un año bisiesto?');
    console.log('[Router] Respuesta de la IA:', iaResponse?.answer);
    // Aquí podrías usar otro servicio para responder por WhatsApp
  }
    res.sendStatus(200);
});


export default router