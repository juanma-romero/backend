import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let db;

async function connectToDatabase() {
  if (db) { 
    return { db, client };
  }
  try {
    await client.connect();
    const dbName = process.env.NODE_ENV === 'local' ? 'test' : 'dash';
    console.log(`Connected to MongoDB: ${dbName} via db.js`);
    db = client.db(dbName);
    return { db, client };
  } catch (err) {
    console.error('Error connecting to MongoDB via db.js:', err);
    throw err;
  }
}

export { connectToDatabase, client as mongoClient };