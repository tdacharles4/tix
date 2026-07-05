import { cookies } from 'next/headers';

export const SCANNER_COOKIE = 'scanner_token';

export function setScannerCookie(token: string) {
    cookies().set(SCANNER_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8*60*60,
        path: '/',
    });
}

export function clearScannerCookie() {
    cookies().set(SCANNER_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
    });
}