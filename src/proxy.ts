import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/' || /^\/(orders|products|analytics|login)$/.test(path)) {
    const target = request.nextUrl.clone();
    target.pathname = `/ru${path === '/' ? '/orders' : path}`;
    return NextResponse.redirect(target);
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const host = request.nextUrl.host;
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    `connect-src 'self' ws://${host} wss://${host}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "worker-src 'self'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|socket.io|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons|images|workers).*)',
  ],
};
