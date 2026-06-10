import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ['/dashboard'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p)=>pathname.startsWith(p));
}

export async function middleware(req:NextRequest){
  const {pathname} = req.nextUrl;
  let response = NextResponse.next({request:req});

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
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
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