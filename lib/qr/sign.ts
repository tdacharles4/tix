import crypto from 'crypto';

const SECRET = process.env.QR_SECRET!;

export function signTicket(ticketId: string): string {
    const sig = crypto
        .createHmac('sha256', SECRET)
        .update(ticketId)
        .digest('hex')
        .slice(0,16);
    return `${ticketId}.${sig}`;
}

export function verifyTicket(token: string): boolean {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex===-1) return false;
    const ticketId = token.slice(0,dotIndex);
    return signTicket(ticketId)===token;
}

export function extractTicketId(token: string): string {
    return token.slice(0, token.lastIndexOf('.'));
}