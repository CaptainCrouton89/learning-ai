import { mongoConnection } from '../services/database/mongoClient';
import { UserDocument, UserPreferences } from '../services/database/userSchemas';

// Type definitions for NextAuth (will be available once NextAuth is properly installed)
interface NextAuthOptions {
  adapter?: any;
  providers: any[];
  session: {
    strategy: string;
    maxAge: number;
  };
  callbacks: {
    session: (params: { session: any; token: any }) => Promise<any>;
    jwt: (params: { token: any; user?: any }) => Promise<any>;
    signIn: (params: { user: any; account?: any; profile?: any }) => Promise<boolean>;
  };
  pages: {
    signIn: string;
    error: string;
  };
  secret: string | undefined;
  debug: boolean;
}

export const authOptions: NextAuthOptions = {
  adapter: undefined, // Custom MongoDB adapter implementation
  providers: [
    {
      id: 'google',
      name: 'Google',
      type: 'oauth',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    {
      id: 'email',
      name: 'Email',
      type: 'email',
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    },
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    async signIn({ user, account, profile }) {
      // Initialize user preferences on first sign-in
      if (account?.provider && user?.email) {
        try {
          const db = await mongoConnection.connect();
          const usersCollection = db.collection<UserDocument>('users');
          
          const existingUser = await usersCollection.findOne({ email: user.email });
          
          if (!existingUser) {
            const defaultPreferences: UserPreferences = {
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
            };

            await usersCollection.updateOne(
              { email: user.email },
              {
                $setOnInsert: {
                  email: user.email,
                  name: user.name || 'Learning User',
                  image: user.image,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  preferences: defaultPreferences,
                },
              },
              { upsert: true }
            );
          } else {
            // Update last login
            await usersCollection.updateOne(
              { email: user.email },
              {
                $set: {
                  updatedAt: new Date(),
                  ...(user.name && { name: user.name }),
                  ...(user.image && { image: user.image }),
                },
              }
            );
          }
        } catch (error) {
          console.error('Error handling user sign-in:', error);
          // Don't block sign-in for database errors
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

// Helper function to get current user
export async function getCurrentUser(req: Request): Promise<{ id: string; email: string } | null> {
  try {
    // Extract session token from request headers or cookies
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // Verify token and extract user info
    // This is a simplified version - in production, you'd verify the JWT token
    // For now, we'll implement a basic token validation
    
    const db = await mongoConnection.connect();
    const sessionsCollection = db.collection('sessions');
    
    const session = await sessionsCollection.findOne({ sessionToken: token });
    if (!session || session.expires < new Date()) {
      return null;
    }

    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ _id: session.userId });
    
    if (!user) {
      return null;
    }

    return {
      id: user._id!.toString(),
      email: user.email,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Helper function to require authentication
export function requireAuth(handler: (req: Request, user: { id: string; email: string }) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const user = await getCurrentUser(req);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(req, user);
  };
}