// backend/services/ia.service.js

import axios from 'axios';
import 'dotenv/config'; 

const IA_SERVICE_URL = process.env.IA_SERVICE_URL;
 
/**
 * Llama a un endpoint específico del servicio de IA.
 * @param {string} endpoint - El endpoint a llamar (ej. '/analyze-conversation', '/agent-query').
 * @param {string} prompt - El texto principal a enviar.
 * @param {Object} [extraPayload] - Payload adicional o de reemplazo. Si se pasa, se usa en lugar de { prompt }.
 * @returns {Promise<Object|null>} - El resultado del análisis en formato JSON.
 */
export const queryIAService = async (endpoint, prompt, extraPayload = null) => {
  if (!IA_SERVICE_URL) {
    console.error("[ia.service] IA_SERVICE_URL no está definida en las variables de entorno.");
    return null;
  }
  const body = extraPayload ?? { prompt };
  try {
    console.log(`[ia.service] Enviando petición a ${IA_SERVICE_URL}${endpoint}.`);
    const response = await axios.post(`${IA_SERVICE_URL}${endpoint}`, body);
    return response.data;
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`[ia.service] Error al llamar a IA Service en el endpoint ${endpoint}:`, errorMsg);
    return null;
  }
};