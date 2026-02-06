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
    console.log('Connected to MongoDB via db.js');
    db = client.db('dash');
    return { db, client };
  } catch (err) {
    console.error('Error connecting to MongoDB via db.js:', err);
    throw err;
  }
}

export { connectToDatabase, client as mongoClient };
