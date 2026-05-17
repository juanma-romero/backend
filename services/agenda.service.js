import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { getPendingChats } from './mongo.service.js';
import { notifyAdmin } from './notification.service.js';
import dotenv from 'dotenv';

dotenv.config();

const agenda = new Agenda({
  backend: new MongoBackend({
    address: process.env.MONGODB_URI,
    collection: 'agendaJobs'
  })
});

// Definir el trabajo 'notificar pendientes'
agenda.define('notificar pendientes', async (job) => {
  console.log('[Agenda] Ejecutando trabajo: notificar pendientes');
  
  try {
    const pendingChats = await getPendingChats();
    
    if (pendingChats && pendingChats.length > 0) {
      const chatNames = pendingChats.map(chat => chat.contactName || 'Desconocido').join(', ');
      const message = `🔔 *Resumen de Pendientes*\n\nTienes ${pendingChats.length} cliente(s) esperando respuesta:\n${chatNames}`;
      
      await notifyAdmin(message);
      console.log(`[Agenda] Notificación enviada con ${pendingChats.length} pendientes.`);
    } else {
      console.log('[Agenda] No hay chats pendientes de respuesta. No se envía notificación.');
    }
  } catch (error) {
    console.error('[Agenda] Error ejecutando notificar pendientes:', error);
  }
});

export const startAgenda = async () => {
  await agenda.start();
  console.log('[Agenda] Servicio iniciado con éxito.');
  
  // Programar el trabajo a las 6:00, 8:00, 10:00, 14:00, 18:00, 22:00
  // El formato cron es: "minuto hora dia_mes mes dia_semana"
  await agenda.every('0 6,8,10,14,18,22 * * *', 'notificar pendientes', {}, { timezone: 'America/Asuncion' });
  console.log('[Agenda] Tarea "notificar pendientes" programada.');
};

export default agenda;
