// routes/messages.routes.js
import { Router } from 'express';
import { saveMessage } from '../services/mongo.service.js';
import { triggerConversationAnalysis } from '../services/analysis.service.js';

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

  // 2. Si el mensaje es del cliente (no nuestro), activamos la lógica de análisis.
  if (messageData.key && !messageData.key.fromMe) {
    const contactJid = messageData.key.remoteJid;
    const ANALYSIS_DELAY = 45000; // 45 segundos, como definiste.

    // Si ya hay un análisis programado, lo cancelamos para reiniciar la cuenta.
    if (pendingAnalysisTimers.has(contactJid)) {
      clearTimeout(pendingAnalysisTimers.get(contactJid));
    }

    // Programamos el nuevo análisis para dentro de 45 segundos.
    const timerId = setTimeout(() => {
      console.log(`[Router] Tiempo de calma finalizado para ${contactJid}. Disparando análisis.`);
      triggerConversationAnalysis(contactJid);
      pendingAnalysisTimers.delete(contactJid); // Limpiamos el mapa
    }, ANALYSIS_DELAY);

    // Guardamos la referencia al nuevo temporizador.
    pendingAnalysisTimers.set(contactJid, timerId);
  }

  // 3. Respondemos 200 OK inmediatamente al webhook. No esperamos el análisis.
  res.sendStatus(200);
});

// Puedes dejar este endpoint de admin por si lo necesitas en el futuro,
// pero la lógica principal de análisis ya no está aquí.
router.post('/whatsapp-inbound', async (req, res) => {
    console.log("[Router /whatsapp-inbound] Endpoint de admin recibido.");
    // Aquí podrías añadir lógica específica para comandos de admin si es necesario.
    res.sendStatus(200);
});

export default router;