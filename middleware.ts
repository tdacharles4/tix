import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyScannerToken } from "./lib/scanner/jwt";
import { SCANNER_COOKIE } from "./lib/scanner/cookies";

const PROTECTED_PATHS = ['/dashboard'];

// Scanner Accounts
const MOBILE_REGEX = /Android|iPhone|iPad|iPod|Mobile/i;
const SCANNER_HOST = process.env.NEXT_PUBLIC_SCANNER_HOST ?? 'scan.localhost';

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p)=>pathname.startsWith(p));
}

export async function middleware(req:NextRequest){
  const {pathname} = req.nextUrl;
  // req.nextUrl.hostname can be unreliable in Next.js dev — use the Host header instead
  const host = (req.headers.get('host') ?? '').split(':')[0]; // strips port
  const ua = req.headers.get('user-agent') ?? '';
  const isMobile = MOBILE_REGEX.test(ua);
  const isScanner = host === SCANNER_HOST;

  // Scanner
  if (isScanner){
    // API routes: skip mobile check, just verify token (login/logout are public)
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/scanner/login' || pathname === '/api/scanner/logout') {
        return NextResponse.next();
      }
      const token = req.cookies.get(SCANNER_COOKIE)?.value;
      const payload = token ? await verifyScannerToken(token) : null;
      if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.next();
    }

    // Page routes: enforce mobile-only
    if (!isMobile && pathname !== '/scan/desktop-only') {
      return NextResponse.redirect(new URL('/scan/desktop-only', req.url));
    }
    if (pathname === '/scan/login' || pathname === '/scan/desktop-only') {
      return NextResponse.next();
    }
    const token = req.cookies.get(SCANNER_COOKIE)?.value;
    const payload = token ? await verifyScannerToken(token) : null;
    if (!payload) {
      return NextResponse.redirect(new URL('/scan/login', req.url));
    }
    return NextResponse.next();
  }
  if (pathname.startsWith('/scan/')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Supabase
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name,value})=>req.cookies.set(name,value));
          response = NextResponse.next({request:req});
          cookiesToSet.forEach(({name,value,options})=>
            response.cookies.set(name,value,options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected(pathname)) {
    if (!user) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id',user.id)
      .single();

    if (profile?.status === 'pending') {
      return NextResponse.redirect(new URL('/pending', req.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)',],
}