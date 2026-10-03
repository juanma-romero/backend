import { Router } from 'express';
import { sendClientMessage } from '../services/notification.service.js';

const router = Router();

/**
 * Webhook que recibe eventos de Chatwoot.
 * Cuando un agente u operador responde en Chatwoot, este endpoint recibe el evento
 * y despacha el mensaje al WhatsApp del cliente vía Baileys.
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const { event, message_type, content, conversation, private: isPrivate } = payload;

    // Solo procesamos mensajes nuevos, salientes y no privados (notas internas)
    if (event === 'message_created' && message_type === 'outgoing' && !isPrivate && content) {
      // Obtener el JID del destinatario
      // Chatwoot almacena el source_id o el teléfono del contacto
      const contact = conversation?.meta?.sender || payload.sender;
      const sourceId = conversation?.source_id;
      let targetJid = null;

      if (sourceId && sourceId.includes('@s.whatsapp.net')) {
        targetJid = sourceId;
      } else if (contact?.phone_number) {
        const digits = contact.phone_number.replace(/\D/g, '');
        targetJid = `${digits}@s.whatsapp.net`;
      } else if (contact?.identifier && contact.identifier.includes('@s.whatsapp.net')) {
        targetJid = contact.identifier;
      }

      if (targetJid) {
        console.log(`[Chatwoot Webhook] Mensaje saliente de Chatwoot hacia ${targetJid}: "${content.substring(0, 40)}..."`);
        await sendClientMessage(targetJid, content);
      } else {
        console.warn('[Chatwoot Webhook] No se pudo determinar el JID del destinatario:', payload);
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Chatwoot Webhook] Error procesando evento:', error);
    return res.status(500).json({ error: 'Error interno en webhook de Chatwoot' });
  }
});

export default router;
