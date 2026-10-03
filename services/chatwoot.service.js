import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let cachedInboxId = null;

/**
 * Obtiene los headers de autenticación para la API de Chatwoot.
 */
const getHeaders = () => {
  const token = process.env.CHATWOOT_API_TOKEN;
  return {
    api_access_token: token,
    'Content-Type': 'application/json',
  };
};

/**
 * Obtiene la URL base de Chatwoot configurada.
 */
const getBaseUrl = () => {
  return process.env.CHATWOOT_URL || 'http://rails:3000';
};

/**
 * Obtiene el ID de la cuenta de Chatwoot (por defecto 1).
 */
const getAccountId = () => {
  return process.env.CHATWOOT_ACCOUNT_ID || 1;
};

/**
 * Resuelve el ID numérico del Inbox en Chatwoot.
 * Si no está configurado explícitamente en el .env, lo busca en la lista de bandejas.
 */
export const getInboxId = async () => {
  if (process.env.CHATWOOT_INBOX_ID) {
    return parseInt(process.env.CHATWOOT_INBOX_ID, 10);
  }
  if (cachedInboxId) {
    return cachedInboxId;
  }

  const token = process.env.CHATWOOT_API_TOKEN;
  if (!token) return null;

  try {
    const baseUrl = getBaseUrl();
    const accountId = getAccountId();
    const res = await axios.get(`${baseUrl}/api/v1/accounts/${accountId}/inboxes`, {
      headers: getHeaders(),
      timeout: 5000,
    });

    const inboxes = res.data?.payload || [];
    const targetIdentifier = process.env.CHATWOOT_INBOX_IDENTIFIER || 'edgdHF55vac7Rr1ZUayu51Qx';

    // Buscar por identifier o por nombre
    const found = inboxes.find(
      (ib) => ib.inbox_identifier === targetIdentifier || ib.name?.toLowerCase().includes('whatsapp')
    ) || inboxes[0];

    if (found) {
      cachedInboxId = found.id;
      console.log(`[chatwoot.service] Inbox resuelto automáticamente: ID ${cachedInboxId} (${found.name})`);
      return cachedInboxId;
    }
  } catch (error) {
    console.warn(`[chatwoot.service] No se pudo resolver Inbox ID automáticamente:`, error.message);
  }

  return 1; // Fallback por defecto
};

/**
 * Convierte un WhatsApp JID en formato de teléfono E.164 (+595...) si es un número real.
 * Si es un identificador especial (ej. @lid), retorna null.
 */
export const jidToPhoneNumber = (jid) => {
  if (!jid || jid.includes('@lid') || jid.includes('@g.us')) return null;
  const rawDigits = jid.split('@')[0].replace(/\D/g, '');
  if (rawDigits.length < 9) return null; // No es un número de teléfono válido
  return rawDigits.startsWith('+') ? rawDigits : `+${rawDigits}`;
};

/**
 * Busca o crea un contacto en Chatwoot a partir del JID y nombre de WhatsApp.
 * @param {string} jid - WhatsApp JID del cliente.
 * @param {string} name - Nombre visible o pushName del cliente.
 * @returns {Promise<number|null>} - ID del contacto en Chatwoot.
 */
export const getOrCreateContact = async (jid, name) => {
  const token = process.env.CHATWOOT_API_TOKEN;
  if (!token) return null;

  const baseUrl = getBaseUrl();
  const accountId = getAccountId();
  const phoneNumber = jidToPhoneNumber(jid);
  const displayName = name || (phoneNumber ? phoneNumber : jid.split('@')[0]);

  try {
    // 1. Buscar contacto existente
    let searchUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts/search?q=`;
    searchUrl += encodeURIComponent(phoneNumber || jid);

    const searchRes = await axios.get(searchUrl, { headers: getHeaders(), timeout: 5000 });
    const contacts = searchRes.data?.payload || [];
    if (contacts.length > 0) {
      return contacts[0].id;
    }

    // 2. Si no existe, crearlo (solo incluir phone_number si es un teléfono real válido)
    const contactPayload = {
      name: displayName,
      identifier: jid,
    };
    if (phoneNumber) {
      contactPayload.phone_number = phoneNumber;
    }

    const createRes = await axios.post(
      `${baseUrl}/api/v1/accounts/${accountId}/contacts`,
      contactPayload,
      { headers: getHeaders(), timeout: 5000 }
    );

    return createRes.data?.payload?.contact?.id || null;
  } catch (error) {
    console.error(`[chatwoot.service] Error al buscar/crear contacto (${jid}):`, error.response?.data || error.message);
    return null;
  }
};

/**
 * Busca una conversación abierta para el contacto o crea una nueva.
 * @param {number} contactId - ID del contacto en Chatwoot.
 * @param {string} jid - WhatsApp JID.
 * @returns {Promise<number|null>} - ID de la conversación.
 */
export const getOrCreateConversation = async (contactId, jid) => {
  const token = process.env.CHATWOOT_API_TOKEN;
  if (!token || !contactId) return null;

  const baseUrl = getBaseUrl();
  const accountId = getAccountId();
  const inboxId = await getInboxId();

  try {
    // 1. Buscar conversaciones activas del contacto
    const convsRes = await axios.get(
      `${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
      { headers: getHeaders(), timeout: 5000 }
    );

    const convList = convsRes.data?.payload || [];
    const openConv = convList.find((c) => c.inbox_id === inboxId && c.status !== 'resolved');

    if (openConv) {
      return openConv.id;
    }

    // 2. Si no hay conversación abierta, crear una nueva
    const newConvRes = await axios.post(
      `${baseUrl}/api/v1/accounts/${accountId}/conversations`,
      {
        source_id: jid,
        inbox_id: inboxId,
        contact_id: contactId,
        status: 'open',
      },
      { headers: getHeaders(), timeout: 5000 }
    );

    return newConvRes.data?.id || null;
  } catch (error) {
    console.error(`[chatwoot.service] Error al obtener/crear conversación:`, error.response?.data || error.message);
    return null;
  }
};

/**
 * Reenvía un mensaje entrante de WhatsApp a Chatwoot para que aparezca en la bandeja.
 * @param {Object} params
 * @param {string} params.jid - WhatsApp JID del cliente.
 * @param {string} params.name - Nombre del cliente (pushName).
 * @param {string} params.text - Contenido de texto del mensaje.
 */
export const forwardIncomingToChatwoot = async ({ jid, name, text }) => {
  const token = process.env.CHATWOOT_API_TOKEN;
  if (!token) {
    // Si no está configurado el token, ignoramos silenciosamente
    return;
  }

  if (!jid || !text) return;

  try {
    const contactId = await getOrCreateContact(jid, name);
    if (!contactId) return;

    const conversationId = await getOrCreateConversation(contactId, jid);
    if (!conversationId) return;

    const baseUrl = getBaseUrl();
    const accountId = getAccountId();

    await axios.post(
      `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        content: text,
        message_type: 'incoming',
        private: false,
      },
      { headers: getHeaders(), timeout: 5000 }
    );

    console.log(`[chatwoot.service] Mensaje entrante de ${jid} publicado en Chatwoot (Conv #${conversationId}).`);
  } catch (error) {
    console.error(`[chatwoot.service] Error al publicar mensaje en Chatwoot:`, error.response?.data || error.message);
  }
};
