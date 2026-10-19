import { Router } from 'express';
import { sendClientMessage } from '../services/notification.service.js';
import { saveMessage } from '../services/mongo.service.js';
import { processMessage } from '../services/message.processor.js';

const router = Router();

/**
 * Webhook que recibe eventos de Chatwoot.
 * Cuando un agente u operador responde en Chatwoot, este endpoint recibe el evento
 * y despacha el mensaje al WhatsApp del cliente vía Baileys, además de ejecutar
 * los gatillos de agendamiento si corresponde.
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const { event, message_type, content, conversation, private: isPrivate, content_attributes } = payload;

    // 1. Evitar bucle de eco: si el mensaje proviene de nuestro propio reenvío desde dashWhat2, ignorar
    const sourceAttr = content_attributes?.source || payload?.source;
    if (sourceAttr === 'dashwhat2') {
      console.log(`[Chatwoot Webhook] Ignorando eco con source='dashwhat2' (evita loop saliente).`);
      return res.status(200).json({ status: 'ignored_echo' });
    }

    // 2. Solo procesamos mensajes nuevos, salientes y no privados (notas internas)
    if (event === 'message_created' && message_type === 'outgoing' && !isPrivate) {
      // Obtener el JID del destinatario desde la conversación de Chatwoot
      const sourceId = conversation?.contact_inbox?.source_id || conversation?.source_id;
      const sender = conversation?.meta?.sender || payload?.sender;
      let targetJid = null;

      if (sourceId && (sourceId.includes('@s.whatsapp.net') || sourceId.includes('@lid'))) {
        targetJid = sourceId;
      } else if (sender?.identifier && (sender.identifier.includes('@s.whatsapp.net') || sender.identifier.includes('@lid'))) {
        targetJid = sender.identifier;
      } else if (sender?.phone_number) {
        const digits = sender.phone_number.replace(/\D/g, '');
        targetJid = `${digits}@s.whatsapp.net`;
      } else if (sourceId) {
        const digits = sourceId.replace(/\D/g, '');
        targetJid = `${digits}@s.whatsapp.net`;
      }

      if (!targetJid) {
        console.warn('[Chatwoot Webhook] No se pudo determinar el JID del destinatario:', payload);
        return res.status(200).json({ status: 'no_target_jid' });
      }

      // Si no tiene texto pero tiene adjuntos
      if (!content && payload.attachments && payload.attachments.length > 0) {
        const att = payload.attachments[0];
        console.warn(`[Chatwoot Webhook] Mensaje con adjunto (${att.file_type || 'archivo'}) sin texto recibido para ${targetJid}.`);
        return res.status(200).json({ status: 'attachment_without_text' });
      }

      if (content) {
        console.log(`[Chatwoot Webhook] Mensaje saliente de Chatwoot hacia ${targetJid}: "${content.substring(0, 40)}..."`);
        
        // Enviar a WhatsApp vía Baileys
        await sendClientMessage(targetJid, content);

        // Guardar en Mongo para mantener el historial completo de la conversación
        const syntheticMessage = {
          key: {
            remoteJid: targetJid,
            fromMe: true,
            id: payload.id ? `cw_${payload.id}` : undefined,
          },
          pushName: payload.sender?.name || 'Admin Chatwoot',
          textContent: content,
          content: content,
          timestamp: payload.created_at ? new Date(payload.created_at * 1000) : new Date(),
        };

        try {
          await saveMessage(syntheticMessage);
        } catch (saveErr) {
          console.error('[Chatwoot Webhook] Error guardando mensaje saliente en DB:', saveErr.message);
        }

        // Si el operador escribió un gatillo de pedido ("Entonces te agendo:" o "Modifico tu pedido:"),
        // lo procesamos para que se cree/modifique en ERPNext
        if (content.startsWith('Entonces te agendo:') || content.startsWith('Modifico tu pedido:')) {
          console.log(`[Chatwoot Webhook] Gatillo de pedido detectado desde el panel para ${targetJid}. Disparando processMessage...`);
          try {
            await processMessage(syntheticMessage);
          } catch (procErr) {
            console.error('[Chatwoot Webhook] Error ejecutando gatillo de pedido:', procErr);
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Chatwoot Webhook] Error procesando evento:', error);
    return res.status(500).json({ error: 'Error interno en webhook de Chatwoot' });
  }
});

export default router;
