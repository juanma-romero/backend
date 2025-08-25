import express from 'express';
import http from 'http';
import cors from 'cors'; // Import cors
import { connectToDatabase } from './db.js';
import messagesRouter from './routes/messages.routes.js'; // Importamos el router
// Importamos ambos setters y les damos alias para claridad
import { setCollection as setMongoCollection, setDbClient } from './services/mongo.service.js'; 

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(cors()); // Enable

// Inicializar conexión a la base de datos y pasar la colección a los servicios
async function initializeDatabase() {
  try {
    const { db, client } = await connectToDatabase(); // Obtenemos también el cliente
    const chatCollection = db.collection('chatsV2');
    
    // Inyectamos las dependencias en el servicio de Mongo
    setMongoCollection(chatCollection); 
    setDbClient(client);

    console.log("Base de datos inicializada y dependencias inyectadas en los servicios.");
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
