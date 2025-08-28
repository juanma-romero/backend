// services/command.handler.js
import * as listadoCommand from './commands/listado.js';
import * as mananaCommand from './commands/manana.js';
import * as hoyCommand from './commands/hoy.js';

// Un mapa para registrar todos los comandos disponibles.
// La clave es el nombre del comando (ej. 'listado') y el valor es el módulo del comando.
const commands = {
  'listado': listadoCommand,
  'manana': mananaCommand,
  'hoy': hoyCommand,
  
  // Futuros comandos se agregarán aquí.
  // '/otrocomando': otroComandoModule,
};

/**
 * Procesa el mensaje de un administrador para identificar y ejecutar un comando.
 * @param {string} messageContent - El contenido del mensaje de texto.
 * @returns {Promise<string|null>} - El string de respuesta del comando o null si no hay respuesta.
 */
export const handleAdminCommand = async (messageContent) => {
  // Extraemos la primera palabra para identificar el comando, ej: /listado
  const commandWithSlash = messageContent.split(' ')[0];
  
  // Quitamos la barra '/' para poder buscar en el mapa de comandos.
  const commandName = commandWithSlash.substring(1);

  const command = commands[commandName];

  if (command && typeof command.execute === 'function') {
    console.log(`[CommandHandler] Comando "${commandWithSlash}" reconocido. Ejecutando...`);
    return await command.execute();
  } else {
    console.log(`[CommandHandler] Comando "${commandWithSlash}" no reconocido o no es ejecutable.`);
    return "El comando no fue reconocido. Intenta con /listado, /hoy o /manana.";
  }
};
