// services/commands/pedidos/agendar.js
import { triggerOrderAnalysis } from '../../order.service.js';

export const aliases = ['pedido', 'crear'];

/**
 * Ejecuta el comando para agendar un pedido directo desde el chat de administrador.
 * Uso: /agendar <numero_cliente> <texto_del_pedido>
 * Ejemplo: /agendar 0981222333 1 lomito arabe para hoy a las 20hs
 * @param {Array<string>} args - Argumentos del comando.
 * @returns {Promise<string>} - Respuesta para el administrador.
 */
export const execute = async (args) => {
  if (args.length < 2) {
    return "Uso incorrecto. Formato: /agendar <numero_cliente> <texto del pedido>\nEjemplo: /agendar 0981222333 1 pizza muzzarella para hoy a las 20hs";
  }

  let phoneArgsCount = 0;
  let accumulatedDigits = '';
  let rawPhoneStr = '';

  for (let i = 0; i < args.length; i++) {
    const part = args[i];
    rawPhoneStr += (i > 0 ? ' ' : '') + part;
    phoneArgsCount++;
    
    // Contamos solo los dígitos
    const digitsInPart = part.replace(/\D/g, '');
    accumulatedDigits += digitsInPart;

    // Un número paraguayo típico tiene 10 dígitos (0981...) o 12 dígitos (595981...)
    // Si ya acumulamos 10 o más dígitos, asumimos que terminamos de leer el teléfono.
    if (accumulatedDigits.length >= 10) {
      break;
    }
  }

  // Si no llegamos a 10 dígitos por alguna razón, hacemos fallback al primer argumento
  if (accumulatedDigits.length < 10) {
    phoneArgsCount = 1;
    rawPhoneStr = args[0];
    accumulatedDigits = args[0].replace(/\D/g, '');
  }

  let contactJid = accumulatedDigits.length >= 10 ? accumulatedDigits : rawPhoneStr;

  if (contactJid === accumulatedDigits) {
    // Formateo básico para número paraguayo si empieza con 0
    if (contactJid.startsWith('0') && contactJid.length === 10) {
      contactJid = '595' + contactJid.slice(1);
    }
    contactJid += '@s.whatsapp.net';
  } else {
    // Asegurar que tenga el sufijo si es un número limpio sin formato especial
    if (!contactJid.includes('@s.whatsapp.net') && /^\d+$/.test(contactJid)) {
      contactJid += '@s.whatsapp.net';
    }
  }

  const orderSummaryText = args.slice(phoneArgsCount).join(' ');
  const targetNumber = rawPhoneStr; // Para usar en el mensaje de confirmación

  // Disparamos el análisis de pedido. La función triggerOrderAnalysis se encargará de crear el pedido
  // y de enviar la notificación por WhatsApp al admin cuando se cree exitosamente.
  triggerOrderAnalysis(contactJid, orderSummaryText, 'create').catch(err => {
    console.error('[Command agendar] Error al disparar el análisis:', err);
  });

  return `⏳ Iniciando proceso de agendamiento para ${targetNumber} mediante IA...\nRecibirás una notificación cuando se genere en el sistema.`;
};
