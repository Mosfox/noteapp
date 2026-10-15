const { MongoClient } = require('mongodb');

let client;
let db;

async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.DB_NAME || 'notes-db';

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  await Promise.all([
    db.collection('users').createIndex({ username: 1 }, { unique: true }),
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('notes').createIndex({ userId: 1, updatedAt: -1 }),
    db.collection('notes').createIndex({ userId: 1, category: 1 })
  ]);

  console.log(`Connected to MongoDB database: ${dbName}`);
  return db;
}

function getDB() {
  if (!db) throw new Error('Database has not connected yet.');
  return db;
}

module.exports = { connectDB, getDB };
