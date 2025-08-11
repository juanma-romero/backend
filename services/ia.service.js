import axios from 'axios';
const IA_SERVICE_URL = process.env.IA_SERVICE_URL;

/**
 * Llama al endpoint de análisis de conversación del servicio de IA.
 * @param {string} prompt - El historial de la conversación formateado.
 * @returns {Promise<Object|null>} - El resultado del análisis en formato JSON.
 */
export const queryIAService = async (prompt) => {
  if (!IA_SERVICE_URL) {
    console.error("[ia.service] IA_SERVICE_URL no está definida en las variables de entorno.");
    return null;
  }
  try {
    console.log(`[ia.service] Enviando historial para análisis al servicio de IA.`);
    // Apuntamos al nuevo endpoint /analyze-conversation
    const response = await axios.post(`${IA_SERVICE_URL}/analyze-conversation`, { prompt });
    return response.data;
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[ia.service] Error al llamar a IA Service:', errorMsg);
    return null;
  }
};