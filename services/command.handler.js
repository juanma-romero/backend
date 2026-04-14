// services/command.handler.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = {};

const commandsDir = path.join(__dirname, 'commands');
try {
  const categories = fs.readdirSync(commandsDir, { withFileTypes: true });
  
  for (const category of categories) {
    if (category.isDirectory()) {
      const categoryPath = path.join(commandsDir, category.name);
      const files = fs.readdirSync(categoryPath);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const commandName = file.replace('.js', '');
          const modulePath = `./commands/${category.name}/${file}`;
          
          try {
            const commandModule = await import(modulePath);
            
            commands[commandName] = commandModule;
            
            if (commandModule.aliases && Array.isArray(commandModule.aliases)) {
              commandModule.aliases.forEach(alias => commands[alias] = commandModule);
            }
          } catch (err) {
            console.error(`[CommandHandler] Error cargando el comando ${file}:`, err);
          }
        }
      }
    }
  }
  console.log(`[CommandHandler] Comandos dinámicos cargados (${Object.keys(commands).length}): ${Object.keys(commands).join(', ')}`);
} catch (err) {
  console.error('[CommandHandler] Error al leer los directorios de comandos:', err);
}

/**
 * Procesa el mensaje de un administrador para identificar y ejecutar un comando.
 * @param {string} messageContent - El contenido del mensaje de texto.
 * @returns {Promise<string|null>} - El string de respuesta del comando o null si no hay respuesta.
 */
export const handleAdminCommand = async (messageContent) => {
  const parts = messageContent.split(' ');
  const commandWithSlash = parts[0].toLowerCase();
  const args = parts.slice(1);

  const commandName = commandWithSlash.substring(1);
  const command = commands[commandName];

  if (command && typeof command.execute === 'function') {
    console.log(`[CommandHandler] Comando "${commandWithSlash}" con argumentos [${args.join(', ')}] reconocido. Ejecutando...`);
    return await command.execute(args);
  } else {
    console.log(`[CommandHandler] Comando "${commandWithSlash}" no reconocido o no es ejecutable.`);
    const availableCommands = Object.keys(commands).map(k => `/${k}`).join(', ');
    return `El comando no fue reconocido. Comandos disponibles:\n${availableCommands}`;
  }
};
