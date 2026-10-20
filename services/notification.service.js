import axios from 'axios';
import dotenv from 'dotenv';
import { forwardIncomingToChatwoot, postAdminNoteToChatwoot } from './chatwoot.service.js';

dotenv.config();

/**
 * Notifica al admin SIN molestar al cliente: publica una nota privada en la
 * conversación de Chatwoot del cliente. Si Chatwoot no responde, cae en el DM
 * de WhatsApp al admin (notifyAdmin). Nunca envía nada al chat del cliente.
 * @param {string} clientJid - JID del cliente dueño de la conversación.
 * @param {string} message - Texto de la alerta.
 */
export async function alertAdminOnly(clientJid, message) {
  const noted = await postAdminNoteToChatwoot(clientJid, `🔒 Admin: ${message}`).catch(() => false);
  if (!noted) {
    await notifyAdmin(message);
  }
}

/**
 * Envía una notificación proactiva al número de admin en WhatsApp.
 * @param {string} message - El texto a enviar.
 */
export async function notifyAdmin(message) {
  const dashUrl = process.env.DASHWHAT_URL || 'http://localhost:8880';
  const adminJid = process.env.ADMIN_NOTIFY_JID;

  if (!adminJid) {
    console.warn('[notification.service] ADMIN_NOTIFY_JID no está definido. Simulando envío local:');
    console.log(`\n=== 📱 MENSAJE PARA ADMIN ===\n${message}\n===============================\n`);
    return;
  }

  try {
    await axios.post(`${dashUrl}/send-message`, { jid: adminJid, message });
    console.log(`[notification.service] Notificación enviada al admin (${adminJid}).`);
  } catch (err) {
    // Loguear el error pero no bloquear el flujo principal
    console.error('[notification.service] Error al notificar al admin por WhatsApp (¿Servidor Baileys apagado?):', err.message);
    console.log(`\n=== 📱 SIMULADOR LOCAL (Fallback) ===\n${message}\n=====================================\n`);
  }
}

/**
 * Envía un mensaje de WhatsApp a un cliente específico.
 * @param {string} jid - El JID del cliente (ej. 595981xxxxxx@s.whatsapp.net).
 * @param {string} message - El texto del mensaje.
 */
export async function sendClientMessage(jid, message, options = {}) {
  const dashUrl = process.env.DASHWHAT_URL || 'http://localhost:8880';
  if (!jid) {
    console.warn('[notification.service] No se especificó JID para enviar mensaje al cliente.');
    return;
  }

  try {
    const payload = { jid, message, ...options };
    await axios.post(`${dashUrl}/send-message`, payload);
    console.log(`[notification.service] Mensaje/adjunto enviado al cliente (${jid}).`);

    // Espejar automáticamente en Chatwoot como mensaje saliente de la empresa/bot (si mirror !== false)
    if (options.mirror !== false) {
      forwardIncomingToChatwoot({
        jid,
        text: message || (options.mediaUrl ? '[Archivo adjunto]' : ''),
        fromMe: true
      }).catch((cwErr) => {
        console.warn('[notification.service] Error al espejar mensaje saliente en Chatwoot:', cwErr.message);
      });
    }
  } catch (err) {
    console.error(`[notification.service] Error al enviar mensaje a cliente ${jid} (¿Servidor Baileys apagado?):`, err.message);
    console.log(`\n=== 📱 SIMULADOR MENSAJE A CLIENTE (${jid}) ===\n${message}\n==============================================\n`);
  }
}

