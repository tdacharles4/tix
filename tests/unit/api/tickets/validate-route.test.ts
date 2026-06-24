import { validateAndRedeemTicket } from '@/lib/qr/validate';
import { createClient } from  '@/lib/supabase/server';
import { POST } from '@/app/api/tickets/[id]/validate/route';
import { NextRequest } from 'next/server';
import { it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/qr/validate', () => ({ validateAndRedeemTicket: vi.fn() }));

// 401 cuando no hay usuario autenticado
it('regresa 401 con usuarios no autenticados', async () => {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: {user: null}, error: new Error('no session') }) },
    } as any);

    const req = new NextRequest('http://localhost/api/tickets/t1/validate', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'e1' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) });

    expect(res.status).toBe(401);
})

// 200 cuando ticket es validad y canjeado
it('regresa 200 cuando validateAndRedeemTicket pasa con exito', async () => {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: {user: { email: 'asd@ejemplo.com' } }, error: null }) },
    } as any);
    vi.mocked(validateAndRedeemTicket).mockResolvedValue({ valid: true, ticket: {}, event: {}, buyer: {} } as any);

    const req = new NextRequest('http://localhost/api/tickets/t1/validate', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'e1' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
})

// 500 + mensaje cuando validateAndRedeemTicket() throws
it('500 upon throw', async () => {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: { user: { email: 'asd@ejemplo.com' } }, error: null }) },
    } as any);
    vi.mocked(validateAndRedeemTicket).mockRejectedValue(new Error('boom'));

    const req = new NextRequest('http://localhost/api/tickets/t1/validate', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'e1' }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('boom');
})

// Sin event_id, se llama validate... con undefined en event_id
it('no hay event_id', async () => {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: { user: { email: 'asd@ejemplo.com' } }, error: null }) },
    } as any);
    vi.mocked(validateAndRedeemTicket).mockResolvedValue({ valid: false, reason: 'not_found' } as any );

    const req = new NextRequest('http://localhost/api/tickets/t1/validate', {
        method: 'POST',
        body: JSON.stringify({}),
    });

    await POST(req, { params: Promise.resolve({ id: 't1' }) });

    expect(validateAndRedeemTicket).toHaveBeenCalledWith('t1', undefined, 'asd@ejemplo.com');
})