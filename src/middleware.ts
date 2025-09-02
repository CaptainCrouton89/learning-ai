import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export default async function middleware(req: NextRequest) {
  const session = await auth();
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
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
  const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute || isPublicApiRoute) {
    // Add user ID to headers for API routes even if public
    if (pathname.startsWith('/api') && session?.user?.id) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', session.user.id);
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (!session) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Add user ID to API request headers for authenticated users
  if (pathname.startsWith('/api') && session.user?.id) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', session.user.id);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

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