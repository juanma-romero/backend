// routes/messages.routes.js
import { Router } from 'express';
import { queryIAService } from '../services/ia.service.js';
import { saveMessage } from '../services/mongo.service.js';

const router = Router();

// --- Lógica para el endpoint de clientes ---
router.post('/messages', async (req, res) => {
  // Se define 'messageData' para este scope
  const messageData = req.body.message;
  
  if (!messageData) {
    console.warn("[Router /messages] Se recibió una petición sin cuerpo de mensaje.");
    return res.status(400).send('Cuerpo del mensaje requerido.');
  }

  // 1. Guardar el mensaje (delegamos a mongo.service)
  await saveMessage(messageData);

  // 2. Lógica de negocio (detectar comandos)
  const messageContent = messageData.content || '';
  if (messageContent === '/listado') {
    console.log(`[Router /messages] Comando '/listado' detectado.`);
    // 3. Llamar a la IA (delegamos a ia.service)
    const iaResponse = await queryIAService('¿Cuántos días tiene un año bisiesto?');
    console.log('[Router /messages] Respuesta de la IA:', iaResponse?.answer);
  }

  res.sendStatus(200);
});


// --- Lógica para el endpoint de administradores ---
// El error ocurría aquí porque esta parte no estaba completa en el plan anterior.
router.post('/whatsapp-inbound', async (req, res) => {
    // Se define 'adminMessageData' para este scope, no 'messageData'
    const adminMessageData = req.body;
  
    if (!adminMessageData?.message?.text?.body) {
      console.warn("[Router /whatsapp-inbound] Se recibió una petición sin el formato esperado.");
      return res.status(400).send('Formato de mensaje de admin incorrecto.');
    }
    
    // 2. Lógica de negocio (detectar comandos)
    const messageContent = adminMessageData.message.text.body || '';
    if (messageContent === '/listado') {
      console.log(`[Router /whatsapp-inbound] Comando '/listado' detectado.`);
      // 3. Llamar a la IA (delegamos a ia.service)
      const iaResponse = await queryIAService('¿Cuántos días tiene un año bisiesto?');
      console.log('[Router /whatsapp-inbound] Respuesta de la IA:', iaResponse?.answer);
    }

    res.sendStatus(200);
})


export default router