import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { mongoConnection } from '@/services/database/mongoClient';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const db = await mongoConnection.connect();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
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

    return NextResponse.json({
      message: 'User created successfully',
      userId: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}