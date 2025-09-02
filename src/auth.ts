import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';
import { mongoConnection } from './services/database/mongoClient';
import type { NextAuthConfig } from 'next-auth';

export const config: NextAuthConfig = {
  adapter: MongoDBAdapter(mongoConnection.getClient()),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const db = await mongoConnection.connect();
        const user = await db.collection('users').findOne({ 
          email: credentials.email 
        });

        if (!user || !user.password) {
          throw new Error('User not found');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const db = await mongoConnection.connect();
        const existingUser = await db.collection('users').findOne({ 
          email: user.email 
        });
        
        if (!existingUser) {
          await db.collection('users').insertOne({
            email: user.email,
            name: user.name,
            image: user.image,
            createdAt: new Date(),
            updatedAt: new Date(),
            preferences: {
              defaultExistingUnderstanding: 'Some - I know the basics',
              defaultTimeAvailable: '15-60min',
              learningStyle: 'mixed',
              difficultyPreference: 'adaptive',
              reminderSettings: {
                email: true,
                reminder: true,
                progress: false,
                weeklyReports: false,
              },
              theme: 'system',
            }
          });
        }
      }
      return true;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);