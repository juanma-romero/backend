import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

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
export async function sendClientMessage(jid, message) {
  const dashUrl = process.env.DASHWHAT_URL || 'http://localhost:8880';
  if (!jid) {
    console.warn('[notification.service] No se especificó JID para enviar mensaje al cliente.');
    return;
  }

  try {
    await axios.post(`${dashUrl}/send-message`, { jid, message });
    console.log(`[notification.service] Mensaje enviado al cliente (${jid}).`);
  } catch (err) {
    console.error(`[notification.service] Error al enviar mensaje a cliente ${jid} (¿Servidor Baileys apagado?):`, err.message);
    console.log(`\n=== 📱 SIMULADOR MENSAJE A CLIENTE (${jid}) ===\n${message}\n==============================================\n`);
  }
}

