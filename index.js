import express from 'express';
import http from 'http';
import { connectToDatabase } from './db.js';
import messagesRouter from './routes/messages.routes.js'; // Importamos el router
import { setCollection as setMongoCollection } from './services/mongo.service.js'; // Importamos el setter

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));

// Inicializar conexión a la base de datos y pasar la colección a los servicios
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    const chatCollection = db.collection('chatsV2');
    setMongoCollection(chatCollection); // Le damos la colección al servicio de Mongo
    console.log("Base de datos inicializada y colección inyectada en los servicios.");
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();

// --- El corazón del orquestador ---
// Le decimos a Express que todas las rutas que empiecen con '/api'
// deben ser manejadas por nuestro 'messagesRouter'.
app.use('/api', messagesRouter);
// ----------------------------------

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor orquestador escuchando en el puerto ${port}`);
});