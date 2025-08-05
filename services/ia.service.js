import axios from 'axios';
const IA_SERVICE_URL = process.env.IA_SERVICE_URL;

// Esta función es la única que sabe cómo hablar con el servicio de IA.
export const queryIAService = async (prompt) => {
  if (!IA_SERVICE_URL) {
    console.error("IA_SERVICE_URL no está definida.");
    return null;
  }
  try {
    console.log(`[ia.service] Enviando prompt: "${prompt}"`);
    const response = await axios.post(`${IA_SERVICE_URL}/ask-google-ai`, { prompt });
    return response.data;
  } catch (error) {
    console.error('[ia.service] Error al llamar a IA Service:', error.message);
    return null;
  }
};