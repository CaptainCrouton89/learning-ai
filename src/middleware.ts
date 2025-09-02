import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  // Custom authentication middleware implementation
  // This will be replaced with NextAuth middleware once NextAuth.js is properly installed
  
  const { pathname } = req.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/signin',
    '/auth/signup', 
    '/auth/error',
    '/about',
    '/pricing',
  ];

  // API routes that don't require authentication
  const publicApiRoutes = [
    '/api/auth',
    '/api/health',
  ];

  // Check if the route is public
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // For now, allow all routes (will implement proper auth check once NextAuth is installed)
  // TODO: Implement proper authentication check here
  return NextResponse.next();
}

// Apply middleware to these routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};