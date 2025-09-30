// services/commands/odoo.js
import axios from 'axios';

import dotenv from 'dotenv';

dotenv.config();

const ODOO_API_URL = process.env.ODOO_API_URL;

/**
 * Ejecuta una llamada de prueba al servicio de Odoo.
 * @param {string[]} args - Argumentos pasados al comando (no se usan por ahora).
 * @returns {Promise<string>} - Un mensaje indicando el resultado de la conexión.
 */
export const execute = async (args) => {
  try {
    // Hacemos una petición GET a la raíz de la API de Odoo para probar la conexión.
    // Más adelante, podrías cambiar esto a un endpoint específico, ej. '/status'.
    const response = await axios.get(ODOO_API_URL);

    // Extraemos el mensaje del JSON de respuesta
    const mensaje = response.data.mensaje;

    // Si la API responde, devolvemos el mensaje específico del JSON.
    console.log('[OdooCommand] Conexión con Odoo API exitosa.');
    console.log('[OdooCommand] Respuesta de la API:', mensaje);
    return mensaje;
  } catch (error) {
    // Si hay un error en la conexión, lo registramos y devolvemos un mensaje de error.
    console.error('[OdooCommand] Error al conectar con Odoo API:', error.message);
    return 'No se pudo conectar con el servicio de Odoo. Por favor, verifica que esté corriendo en el puerto 8008.';
  }
};
