// services/commands/informes/consultar.js
// ─────────────────────────────────────────────────────────────────────────────
// Comando /consultar — delega al Agente IA del ia-service.
// 
// Uso:
//   /consultar ventas del mes pasado
//   /consultar productos más vendidos esta semana
//   /consultar pedidos pendientes
//
// El agente recibe el texto libre, elige la tool adecuada, la ejecuta y
// formula la respuesta en lenguaje natural formateada para WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

import { queryIAService } from '../../ia.service.js';

export const aliases = ['informe', 'info'];

/**
 * Ejecuta el comando /consultar.
 * @param {Array<string>} args - Palabras del mensaje después del comando.
 * @returns {Promise<string>} - Respuesta formateada para WhatsApp.
 */
export const execute = async (args) => {
  if (!args || args.length === 0) {
    return (
      '🤖 *Asistente Voraz*\n\n' +
      'Escribí tu consulta después del comando. Ejemplos:\n\n' +
      '• `/consultar ventas del mes pasado`\n' +
      '• `/consultar productos más vendidos esta semana`\n' +
      '• `/consultar pedidos pendientes`\n' +
      '• `/consultar cuánto vendimos hoy`'
    );
  }

  const query = args.join(' ');
  console.log(`[Command consultar] Query al agente: "${query}"`);

  try {
    // El agente espera { query }, no { prompt } — usamos el extraPayload
    const result = await queryIAService('/agent-query', null, { query });

    if (!result || !result.response) {
      return '⚠️ El agente no pudo generar una respuesta. Intentá de nuevo.';
    }

    return result.response;

  } catch (error) {
    console.error('[Command consultar] Error al contactar al agente:', error.message);
    return '❌ Hubo un error al consultar al asistente. Verificá que el servicio de IA esté activo.';
  }
};
