import { MongoClient, Db } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local file manually
let uri: string | undefined;
try {
  const envPath = join(__dirname, '../../../.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('MONGODB_URI=')) {
      uri = line.substring('MONGODB_URI='.length).replace(/"/g, '');
      break;
    }
  }
} catch (error) {
  console.error('Error reading .env.local:', error);
}

if (!uri) {
  throw new Error('MONGODB_URI is not defined in .env.local file');
}

class MongoConnection {
  private static instance: MongoConnection;
  private client: MongoClient;
  private db: Db | null = null;
  private isConnected: boolean = false;

  private constructor() {
    this.client = new MongoClient(uri!);
  }

  static getInstance(): MongoConnection {
    if (!MongoConnection.instance) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  async connect(): Promise<Db> {
    if (this.isConnected && this.db) {
      return this.db;
    }

    try {
      await this.client.connect();
      this.db = this.client.db('learning-ai');
      this.isConnected = true;
      console.log('Connected to MongoDB Atlas');
      return this.db;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }
}

export const mongoConnection = MongoConnection.getInstance();