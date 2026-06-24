import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServiceClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/checkout/route';
import { fakeSupabase } from '@/tests/helpers/fakeSupabase';
import { NextRequest } from 'next/server';
import { getPlatformFee } from '@/lib/utils';

vi.mock('@/lib/supabase/server', () => ({
    createServiceClient: vi.fn(),
}));

// Helpers

function sesionBase(overrides = {}) {
    return {
        used: false,
        expires_at: new Date(Date.now()+60_000).toISOString(),
        max_quantity: 10,
        ticket_type_config_id: null,
        ...overrides,
    };
};
function eventoBase(overrides = {}) {
    return { status: 'live', max_tickets_per_order: 10, ...overrides };
};
function requestBody(overrides = {}) {
    return { eventId: 'e1', quantity: 2, buyerName: 'Test', buyerEmail: 'test@ejemplo.com', sessionToken: 's1', ...overrides };
};

// Sin tipo de ticket
it('no override when no ticket_type_config_id', async () => {
    const fake = fakeSupabase({
        from: {
            checkout_sessions:  { data: sesionBase(), error: null },
            events:             { data: sesionBase(), error: null }
        }
    });
    vi.mocked(createServiceClient).mockReturnValue( fake as any );

    const req = new NextRequest('https://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody()),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('reserve_tickets', expect.objectContaining({
        p_unit_price_override: null,
    }));
});

// Con tipo de ticket, busqueda exitosa
it('utiliza tipo de ticket en busqueda exitosa', async () => {
    const fake = fakeSupabase({
        from: {
            checkout_sessions:      { data: sesionBase({ ticket_type_config_id: 'tc1' }), error: null },
            events:                 { data: eventoBase(), error: null },
            ticket_type_configs:    { data: { name: 'Test Phase', price_mxn: 200 }, error: null },
        },
        rpc: { reserve_tickets:     { data: 'orden-1', error: null } },
    });
    vi.mocked(createServiceClient).mockReturnValue(fake as any);

    const res = await POST(new NextRequest('https://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody()),
    }));

    expect(res.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('reserve_tickets', expect.objectContaining({
        p_unit_price_override: 200,
    }))
});

// Ruta doesnt throw cuando ticket row no existe
it('utiliza tipo de ticket en busqueda exitosa', async () => {
    const fake = fakeSupabase({
        from: {
            checkout_sessions:      { data: sesionBase({ ticket_type_config_id: 'tc1' }), error: null },
            events:                 { data: eventoBase(), error: null },
            ticket_type_configs:    { data: null, error: null }, // ticket data is null
        },
        rpc: { reserve_tickets:     { data: 'orden-1', error: null } },
    });
    vi.mocked(createServiceClient).mockReturnValue(fake as any);

    const res = await POST(new NextRequest('https://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody()),
    }));

    expect(res.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('reserve_tickets', expect.objectContaining({
        p_unit_price_override: null, // retorna null price
    }))
});

// Llamada toma precio de ticket sobre precio base de evento cuando existen ambos casos
it('precio de ticket toma precedencia sobre precio de evento', async () => {
    const fake = fakeSupabase({
        from: {
            checkout_sessions:      { data: sesionBase({ ticket_type_config_id: 'tc1' }), error: null },
            events:                 { data: eventoBase({ price_mxn: 999999 }), error: null },
            ticket_type_configs:    { data: { name: 'Test Phase', price_mxn: 500 }, error: null},
        },
        rpc: { reserve_tickets: { data: 'orden-1', error: null } },
    });
    vi.mocked(createServiceClient).mockReturnValue(fake as any);

    await POST(new NextRequest('https://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody()),
    }));

    expect(fake.rpc).toHaveBeenCalledWith('reserve_tickets', {
        p_event_id: 'e1',
        p_quantity: 2,
        p_buyer_id: null,
        p_buyer_email: 'test@ejemplo.com',
        p_buyer_name: 'Test',
        p_platform_fee: getPlatformFee(2), // import the real fn, don't hardcode
        p_unit_price_override: 500,
    });
});