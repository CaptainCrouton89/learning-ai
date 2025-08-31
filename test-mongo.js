import { mongoConnection } from './dist/services/database/mongoClient.js';

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    const db = await mongoConnection.connect();
    console.log('✅ Successfully connected to MongoDB Atlas!');
    
    // Test creating collections
    const collections = await db.listCollections().toArray();
    console.log('Existing collections:', collections.map(c => c.name));
    
    // Ping the database
    await db.admin().ping();
    console.log('✅ Database ping successful!');
    
    await mongoConnection.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }
}

testConnection();