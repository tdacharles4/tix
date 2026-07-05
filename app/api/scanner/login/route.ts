import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/scanner/password";
import { signScannerToken } from "@/lib/scanner/jwt";
import { SCANNER_COOKIE } from "@/lib/scanner/cookies";

export async function POST(req: NextRequest) {
    const { username, password } = await req.json();

    if (!username || !password){
        return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: account } = await supabase
        .from('scanner_accounts')
        .select('id, organizer_id, password_hash')
        .eq('username', username)
        .single();
    if(!account) {
        await verifyPassword('__dummy__', '$2b$12$invalidhashpadding000000000000000000000000000000000000');
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, account.password_hash);
    if(!valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signScannerToken({
        scanner_id: account.id,
        organizer_id: account.organizer_id,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SCANNER_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
        path: '/',
    });
    return response;
}