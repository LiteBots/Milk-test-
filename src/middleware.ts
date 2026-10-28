import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || process.env.JWT_SECRET || 'dev-only-secret-change-me-please-0123456789');

// Panel /admin dostępny tylko po zalogowaniu pracownika (dodatkowo każde API sprawdza uprawnienia)
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Stary adres z polskim znakiem: /zamów → /zamow (301)
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    /* zostaw */
  }
  if (decoded.startsWith('/zamów')) {
    const url = req.nextUrl.clone();
    url.pathname = '/zamow';
    return NextResponse.redirect(url, 301);
  }
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/logowanie')) {
    const token = req.cookies.get('mm_staff')?.value;
    let ok = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, SECRET);
        ok = payload.kind === 'staff' && !payload.pending2fa;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/logowanie';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }
  const res = NextResponse.next();
  if (pathname.startsWith('/admin') || pathname.startsWith('/app')) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = { matcher: ['/admin/:path*', '/app/:path*', '/zam(.*)'] };
