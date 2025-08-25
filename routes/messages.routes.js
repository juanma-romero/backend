// routes/messages.routes.js
import { Router } from 'express';
import { saveMessage } from '../services/mongo.service.js';
import { triggerConversationAnalysis } from '../services/analysis.service.js';
import { triggerOrderAnalysis } from '../services/order.service.js'

const router = Router();

// Usamos un Map para manejar los temporizadores de análisis pendientes por cada chat.
const pendingAnalysisTimers = new Map();

// Endpoint que recibe los mensajes de los clientes.
router.post('/messages', async (req, res) => {
  const messageData = req.body.message;

  if (!messageData) {
    console.warn("[Router /messages] Petición recibida sin cuerpo de mensaje.");
    return res.status(400).send('Cuerpo del mensaje requerido.');
  }
 
  // 1. Guardar el mensaje en la DB inmediatamente.
  await saveMessage(messageData);
  
  // 2. Activamos la lógica de análisis.
  if (messageData.key) {
    
    const contactJid = messageData.key.remoteJid;
    const isFromMe = messageData.key.fromMe;
    // Corregido: Acceder a messageData.content directamente
    const textContent = messageData.content || '';

    // Lógica para detectar el comando de "agendar"
    if (isFromMe && textContent.startsWith('Entonces te agendo:')) {
      console.log(`[Router] Comando de agendar detectado. Disparando análisis de pedido.`);
      // Detenemos cualquier temporizador de análisis de estado pendiente
      if (pendingAnalysisTimers.has(contactJid)) {
        clearTimeout(pendingAnalysisTimers.get(contactJid));
        pendingAnalysisTimers.delete(contactJid);
      }
      // Llama a la nueva función de análisis de pedido
      await triggerOrderAnalysis(contactJid);
      // Salimos para no activar el temporizador de análisis general
      return res.sendStatus(200);
    }
    // Lógica original de análisis de estado (se mantiene)
    const ANALYSIS_DELAY = 60000;
    if (pendingAnalysisTimers.has(contactJid)) {
      clearTimeout(pendingAnalysisTimers.get(contactJid));
    }

    const timerId = setTimeout(() => {
      console.log(`[Router] Tiempo de calma finalizado para ${contactJid}. Disparando análisis de estado.`);
      triggerConversationAnalysis(contactJid);
      pendingAnalysisTimers.delete(contactJid);
    }, ANALYSIS_DELAY);
    
    pendingAnalysisTimers.set(contactJid, timerId);
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

export default router;
