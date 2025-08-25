// services/command.handler.js
import * as listadoCommand from './commands/listado.js';

// Un mapa para registrar todos los comandos disponibles.
// La clave es el nombre del comando (ej. '/listado') y el valor es el módulo del comando.
const commands = {
  '/listado': listadoCommand,
  // Futuros comandos se agregarán aquí.
  // '/otrocomando': otroComandoModule,
};

/**
 * Procesa el mensaje de un administrador para identificar y ejecutar un comando.
 * @param {string} messageContent - El contenido del mensaje de texto.
 */
export const handleAdminCommand = async (messageContent) => {
  // Extraemos la primera palabra para identificar el comando.
  const commandName = messageContent.split(' ')[0];

  const command = commands[commandName];

  if (command && typeof command.execute === 'function') {
    console.log(`[CommandHandler] Comando "${commandName}" reconocido. Ejecutando...`);
    // Por ahora, no pasamos argumentos, pero la estructura lo permite.
    // Ejemplo: await command.execute(args);
    await command.execute();
  } else {
    console.log(`[CommandHandler] Comando "${commandName}" no reconocido o no es ejecutable.`);
    // Opcional: enviar una respuesta de "comando no encontrado" al admin.
  }
};
