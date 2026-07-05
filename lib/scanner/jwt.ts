import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.SCANNER_JWT_SECRET!);
const EXPIRY = '8h';

export type ScannerJWTPayload = {
    scanner_id : string;
    organizer_id : string;
};

export async function signScannerToken(payload: ScannerJWTPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(EXPIRY)
        .sign(SECRET);
}

export async function verifyScannerToken(
    token: string,
): Promise<ScannerJWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as ScannerJWTPayload;
    } catch {
        return null;
    }
}