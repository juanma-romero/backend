// services/contact_filter.service.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';

let filteredCollection = null;
let chatCollection = null;

// In-memory cache for ultra-fast O(1) synchronous message checking
// Map: key (jid or phone) -> contact info
const filterCache = new Map();

/**
 * Normaliza un número de teléfono o JID.
 * Acepta: "0983 823 396", "+595 983 823396", "595983823396@s.whatsapp.net", "12345@lid"
 */
export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();

  if (trimmed.endsWith('@lid')) {
    const digits = trimmed.replace('@lid', '').replace(/\D/g, '');
    if (!digits) return null;
    return {
      phone: digits,
      jid: `${digits}@lid`,
      isLid: true
    };
  }

  // Remover sufijo de WhatsApp si lo tiene
  let clean = trimmed.replace(/@s\.whatsapp\.net$/i, '');
  // Quitar todo lo que no sea dígito
  clean = clean.replace(/\D/g, '');

  if (!clean) return null;

  // Formato local Paraguay (ej: 0983123456 -> 595983123456)
  if (clean.startsWith('09') && clean.length === 10) {
    clean = '595' + clean.substring(1);
  } else if (clean.startsWith('9') && clean.length === 9) {
    clean = '595' + clean;
  }

  return {
    phone: clean,
    jid: `${clean}@s.whatsapp.net`,
    isLid: false
  };
}

/**
 * Inicializa el servicio con la base de datos MongoDB y carga el caché.
 */
export async function initContactFilterService(db) {
  try {
    filteredCollection = db.collection('filtered_contacts');
    chatCollection = db.collection('chatsV2');

    // Índices para búsquedas rápidas y evitar duplicados
    await filteredCollection.createIndex({ jid: 1 }, { unique: true, sparse: true });
    await filteredCollection.createIndex({ phone: 1 });

    // Auto-seed si la colección está vacía
    const count = await filteredCollection.countDocuments();
    if (count === 0) {
      await seedInitialFilters();
    }

    await reloadCacheFromDb();
    console.log(`[contact_filter] Servicio inicializado. ${filterCache.size} filtros cargados en caché.`);
  } catch (err) {
    console.error('[contact_filter] Error inicializando servicio:', err);
  }
}

/**
 * Carga los filtros de MongoDB en la memoria caché.
 */
async function reloadCacheFromDb() {
  if (!filteredCollection) return;
  try {
    const docs = await filteredCollection.find({ active: { $ne: false } }).toArray();
    filterCache.clear();
    for (const doc of docs) {
      if (doc.jid) filterCache.set(doc.jid, doc);
      if (doc.phone) filterCache.set(doc.phone, doc);
    }
  } catch (err) {
    console.error('[contact_filter] Error al recargar caché desde DB:', err);
  }
}

/**
 * Si la colección está vacía, migra los números conocidos de phones.json / teléfonos históricos.
 */
async function seedInitialFilters() {
  const seedList = [
    { phone: '595983823396', name: 'Carnicería', role: 'proveedor', notes: 'Proveedor carne' },
    { phone: '595983607896', name: 'Tirol', role: 'proveedor', notes: 'Proveedor lácteos' },
    { phone: '595984985718', name: 'Sonic', role: 'proveedor', notes: 'Proveedor' },
    { phone: '595973814297', name: 'PDE', role: 'proveedor', notes: 'Proveedor' },
    { phone: '5491122804034', name: 'Martín', role: 'familiar', notes: 'Familiar/Amigo' },
    { phone: '595986433155', name: 'Dash', role: 'interno', notes: 'Bot/Admin' }
  ];

  console.log('[contact_filter] Inicializando colección filtered_contacts con teléfonos base...');
  for (const item of seedList) {
    const norm = normalizePhone(item.phone);
    if (norm) {
      await filteredCollection.updateOne(
        { jid: norm.jid },
        {
          $set: {
            phone: norm.phone,
            jid: norm.jid,
            name: item.name,
            role: item.role,
            notes: item.notes || '',
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    }
  }
}

/**
 * Notifica a dashWhat2 para que sincronice sus filtros inmediatamente.
 */
export async function notifyDashWhat() {
  try {
    const dashUrl = process.env.DASHWHAT_URL || 'http://dashwhat2:8880';
    const url = `${dashUrl.replace(/\/+$/, '')}/reload-filters`;
    await axios.post(url, {}, { timeout: 2500 });
    console.log('[contact_filter] dashWhat2 notificado exitosamente para recarga.');
  } catch (err) {
    // Si dashWhat2 no está disponible (ej. en desarrollo local), solo advertir
    console.warn('[contact_filter] Aviso: dashWhat2 no respondió a reload-filters (normal en local sin dashWhat):', err.message);
  }
}

/**
 * Verifica sincrónicamente en memoria si un JID o teléfono debe ser filtrado.
 * @param {string} remoteJid
 * @returns {Object|null} El objeto de contacto si está filtrado, o null.
 */
export function isFilteredContact(remoteJid) {
  if (!remoteJid) return null;
  // 1. Chequeo directo de JID completo
  if (filterCache.has(remoteJid)) {
    return filterCache.get(remoteJid);
  }
  // 2. Chequeo por número de teléfono antes del @
  const phone = remoteJid.split('@')[0];
  if (filterCache.has(phone)) {
    return filterCache.get(phone);
  }
  return null;
}

/**
 * Retorna todos los contactos filtrados.
 */
export async function getAllFilteredContacts() {
  if (!filteredCollection) {
    return Array.from(new Set(filterCache.values()));
  }
  return await filteredCollection.find({ active: { $ne: false } }).sort({ updatedAt: -1 }).toArray();
}

/**
 * Retorna la lista de JIDs y teléfonos activos para que dashWhat2 los consuma.
 */
export async function getActiveJidsAndPhones() {
  const contacts = await getAllFilteredContacts();
  const jids = new Set();
  const phones = new Set();

  for (const c of contacts) {
    if (c.jid) jids.add(c.jid);
    if (c.phone) {
      phones.add(c.phone);
      jids.add(`${c.phone}@s.whatsapp.net`);
    }
  }

  return {
    jids: Array.from(jids),
    phones: Array.from(phones)
  };
}

/**
 * Agrega o actualiza un contacto en la lista de filtros.
 */
export async function saveFilteredContact({ rawPhone, name, role = 'proveedor', notes = '', cleanHistory = false }) {
  const norm = normalizePhone(rawPhone);
  if (!norm) {
    throw new Error('Número de teléfono inválido');
  }

  const now = new Date();
  const doc = {
    phone: norm.phone,
    jid: norm.jid,
    name: name ? name.trim() : (norm.phone || 'Sin Nombre'),
    role: role || 'otro', // 'proveedor' | 'delivery' | 'familiar' | 'interno' | 'otro'
    notes: notes ? notes.trim() : '',
    active: true,
    updatedAt: now
  };

  if (filteredCollection) {
    await filteredCollection.updateOne(
      { jid: norm.jid },
      {
        $set: doc,
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
  }

  // Actualizar caché en memoria
  filterCache.set(norm.jid, doc);
  filterCache.set(norm.phone, doc);

  // Limpieza opcional de historial previo en chatsV2 si el usuario lo solicitó
  if (cleanHistory && chatCollection) {
    try {
      const result = await chatCollection.deleteMany({
        $or: [
          { contactJid: norm.jid },
          { contactJid: new RegExp(`^${norm.phone}`) }
        ]
      });
      console.log(`[contact_filter] Historial anterior eliminado para ${norm.jid} (${result.deletedCount} chats eliminados).`);
    } catch (err) {
      console.warn('[contact_filter] Error limpiando historial previo:', err.message);
    }
  }

  // Notificar a dashWhat2 asíncronamente
  notifyDashWhat().catch(() => {});

  return doc;
}

/**
 * Elimina un contacto del filtro.
 */
export async function removeFilteredContact(rawPhoneOrJid) {
  const norm = normalizePhone(rawPhoneOrJid);
  const targetJid = norm ? norm.jid : rawPhoneOrJid;
  const targetPhone = norm ? norm.phone : rawPhoneOrJid.split('@')[0];

  if (filteredCollection) {
    await filteredCollection.deleteOne({
      $or: [{ jid: targetJid }, { phone: targetPhone }]
    });
  }

  filterCache.delete(targetJid);
  filterCache.delete(targetPhone);

  // Notificar a dashWhat2 asíncronamente
  notifyDashWhat().catch(() => {});

  return { success: true };
}

/**
 * Obtiene chats recientes de MongoDB que no están en la lista de filtros
 * para que el usuario pueda marcarlos fácilmente con 1 clic.
 */
export async function getRecentUnfilteredChats(limit = 20) {
  if (!chatCollection) return [];
  try {
    const chats = await chatCollection.find({})
      .sort({ updatedAt: -1 })
      .limit(limit * 2)
      .toArray();

    const results = [];
    for (const chat of chats) {
      const jid = chat.contactJid || '';
      const phone = jid.split('@')[0];

      // Ignorar si ya está filtrado
      if (filterCache.has(jid) || filterCache.has(phone)) continue;

      const lastMsg = (chat.messages && chat.messages.length > 0)
        ? chat.messages[chat.messages.length - 1]
        : null;

      results.push({
        contactJid: jid,
        phone: phone,
        contactName: chat.contactName || 'Desconocido',
        updatedAt: chat.updatedAt || chat.createdAt,
        lastMessage: lastMsg ? {
          role: lastMsg.role,
          content: (lastMsg.content || '').substring(0, 100),
          timestamp: lastMsg.timestamp
        } : null
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.error('[contact_filter] Error al obtener chats recientes no filtrados:', err);
    return [];
  }
}
