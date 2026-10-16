/**
 * services/payload_audit.js
 *
 * Auditoría TEMPORAL del payload que llega de `dashWhat2` (backlog: P0 / Idea #20).
 *
 * Propósito: medir, con tráfico real, qué campos del sobre de WhatsApp sobreviven al
 * parseo de Baileys — en particular el par de direcciones nuevo (`@lid` ↔ teléfono),
 * que la doc de Baileys documenta como `key.remoteJidAlt` / `key.participantAlt` /
 * `key.addressingMode`. Con eso se decide si la pérdida de identidad es de **recepción**
 * (hay que tocar `dashWhat2`) o de **persistencia** (hay que tocar `saveMessage()`), lo
 * cual redefine la Idea #16.
 *
 * Reglas de este módulo:
 *  - NO persiste nada: solo stdout (se lee con `docker logs`).
 *  - NO imprime contenido de mensajes ni URLs de media: solo estructura (rutas de
 *    campos) y identificadores ENMASCARADOS.
 *  - Una sola línea por mensaje, JSON compacto: se agrega con `jq` sin parsing frágil.
 *  - Se apaga con `LOG_RAW_MESSAGES=false` (durante la auditoría el default es ON para
 *    no depender de editar el compose de producción).
 */

const AUDIT_ON = process.env.LOG_RAW_MESSAGES !== 'false';

const MAX_DEPTH = 5;
const MAX_PATHS = 120;

/** Enmascara un JID: conserva prefijo, longitud y dominio; oculta el número. */
const maskJid = (jid) => {
  if (typeof jid !== 'string' || !jid) return jid === undefined ? 'AUSENTE' : 'vacio';
  const at = jid.indexOf('@');
  const digits = at >= 0 ? jid.slice(0, at) : jid;
  const domain = at >= 0 ? jid.slice(at) : '(sin-dominio)';
  const clean = digits.replace(/\D/g, '');
  if (clean.length <= 6) return `?*${clean.length}d${domain}`;
  return `${clean.slice(0, 4)}***${clean.slice(-2)}${domain} (${clean.length}d)`;
};

/** Recoge las rutas de campos (`a.b.c`, arrays como `a[]`) sin sus valores. */
const collectPaths = (obj, prefix, out, depth = 0) => {
  if (obj === null || obj === undefined) return out;
  if (depth >= MAX_DEPTH || out.size >= MAX_PATHS) return out;

  if (Array.isArray(obj)) {
    out.add(`${prefix}[]`);
    for (const item of obj) collectPaths(item, `${prefix}[]`, out, depth + 1);
    return out;
  }

  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      out.add(path);
      collectPaths(v, path, out, depth + 1);
    }
  }
  return out;
};

/** Valor escalar o marca, para los campos que importan del esquema de direcciones. */
const scalar = (v, kind = 'plain') => {
  if (v === undefined) return 'AUSENTE';
  if (v === null) return 'null';
  if (kind === 'jid') return maskJid(v);
  if (typeof v === 'object') return '{obj}';
  return v;
};

const len = (v) => (typeof v === 'string' ? v.length : v === undefined ? 'AUSENTE' : '{otro}');

/**
 * Imprime una línea de auditoría para el payload recibido en `POST /api/messages`.
 * @param {Object} messageData - Cuerpo `message` ya parseado por `dashWhat2`.
 */
export const logPayloadAudit = (messageData) => {
  if (!AUDIT_ON) return;
  try {
    const key = messageData?.key || {};
    const paths = Array.from(collectPaths(messageData, '', new Set())).sort();

    const line = {
      // — identidad / direccionamiento (lo que motiva la auditoría) —
      remoteJid: scalar(key.remoteJid, 'jid'),
      remoteJidAlt: scalar(key.remoteJidAlt, 'jid'),
      participant: scalar(key.participant, 'jid'),
      participantAlt: scalar(key.participantAlt, 'jid'),
      participantPn: scalar(key.participantPn, 'jid'),
      remoteJidPn: scalar(key.remoteJidPn, 'jid'),
      addressingMode: scalar(key.addressingMode),
      authorPn: scalar(key.authorPn, 'jid'),
      fromMe: scalar(key.fromMe),
      // — tipo y metadatos que llegan vivos —
      type: messageData?.type ?? 'AUSENTE',
      hasMediaUrl: messageData?.mediaUrl !== undefined,
      hasCaption: messageData?.caption !== undefined,
      hasLocation: messageData?.location !== undefined,
      hasQuoted: messageData?.quotedMessage !== undefined,
      hasContactInfo: messageData?.contactInfo !== undefined,
      hasReaction: messageData?.reaction !== undefined,
      // pushName solo se mide (de ahí salen los Customer basura del ERP)
      pushNameLen: len(messageData?.pushName),
      ts: messageData?.messageTimestamp ?? 'AUSENTE',
      // — estructura completa —
      paths,
    };

    console.log(`[AUDIT-PAYLOAD] ${JSON.stringify(line)}`);
  } catch (err) {
    // La auditoría jamás debe romper el flujo de mensajes.
    console.warn('[AUDIT-PAYLOAD] fallo al auditar (se ignora):', err.message);
  }
};

export default logPayloadAudit;
