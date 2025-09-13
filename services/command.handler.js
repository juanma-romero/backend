// services/command.handler.js
import * as listadoCommand from './commands/listado.js';
import * as mananaCommand from './commands/manana.js';
import * as hoyCommand from './commands/hoy.js';
import * as completoCommand from './commands/completo.js';
import * as reactivarCommand from './commands/reactivar.js';

// Un mapa para registrar todos los comandos disponibles.
// La clave es el nombre del comando (ej. 'listado') y el valor es el módulo del comando.
const commands = {
  'listado': listadoCommand,
  'manana': mananaCommand,
  'hoy': hoyCommand,
  'hecho': completoCommand,
  'reactivar': reactivarCommand,

  // Futuros comandos se agregarán aquí.
  // '/otrocomando': otroComandoModule,
};

/**
 * Procesa el mensaje de un administrador para identificar y ejecutar un comando.
 * @param {string} messageContent - El contenido del mensaje de texto.
 * @returns {Promise<string|null>} - El string de respuesta del comando o null si no hay respuesta.
 */
export const handleAdminCommand = async (messageContent) => {
  // Dividimos el mensaje en partes para separar el comando de los argumentos
  const parts = messageContent.split(' ');
  const commandWithSlash = parts[0];
  const args = parts.slice(1); // El resto son argumentos

  // Quitamos la barra '/' para poder buscar en el mapa de comandos.
  const commandName = commandWithSlash.substring(1);

  const command = commands[commandName];

  if (command && typeof command.execute === 'function') {
    console.log(`[CommandHandler] Comando "${commandWithSlash}" con argumentos [${args.join(', ')}] reconocido. Ejecutando...`);
    // Pasamos los argumentos a la función execute
    return await command.execute(args);
  } else {
    console.log(`[CommandHandler] Comando "${commandWithSlash}" no reconocido o no es ejecutable.`);
    return "El comando no fue reconocido. Intenta con /listado, /hoy, /manana, /hecho <num-pedido> o /reactivar <num-pedido>.";
  }
};
