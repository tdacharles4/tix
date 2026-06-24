import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);

let userId: string;
let eventId: string;
let orderId: string;
let ticketId: string;

beforeAll(async () => {
    const { data: u, error: uErr } = await supabase.auth.admin.createUser({
        email: `organizer-${Date.now()}@test.local`,
        password: 'test123',
        email_confirm: true,
    });
    if (uErr) throw uErr;
    userId = u.user.id;

    const { data: event, error: eErr } = await supabase
        .from('events')
        .insert({ organizer_id: userId, title: 'Test', capacity: 100, price_mxn: 100 })
        .select()
        .single();
    if (eErr) throw eErr;
    eventId = event.id;

    const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({ event_id: eventId, amount_mxn: 100, platform_fee_mxn: 10, buyer_email: 'b@test.local', buyer_name: 'Braulio' })
        .select()
        .single();
    if (oErr) throw oErr;
    orderId = order.id;

    const { data: ticket, error: tErr } = await supabase
        .from('tickets')
        .insert({ order_id: orderId, event_id: eventId, buyer_email: 'b@test.local' })
        .select()
        .single();
    if (tErr) throw tErr;
    ticketId = ticket.id;
});

afterAll(async () => {
  if (ticketId) await supabase.from('tickets').delete().eq('id', ticketId);
  if (orderId) await supabase.from('orders').delete().eq('id', orderId);
  if (eventId) await supabase.from('events').delete().eq('id', eventId);
  if (userId) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

it('gana 1 de 2 redeems al mismo tiempo', async () => {
    const [a,b] = await Promise.all([
        supabase.rpc('redeem_ticket', { p_ticket_id: ticketId, p_event_id: eventId, p_scanned_by: 'A' }),
        supabase.rpc('redeem_ticket', { p_ticket_id: ticketId, p_event_id: eventId, p_scanned_by: 'B' }),
    ]);

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    const winners = [a,b].filter((r) => r.data?.length === 1 );
    expect(winners.length).toBe(1);
});

it('estad igual al del ganador de RPC', async () => {
    const { data: finalTicket } = await supabase
        .from('tickets')
        .select('status, redeemed_by' )
        .eq('id', ticketId)
        .single();
    expect(finalTicket?.status).toBe('redeemed');
    expect(['A','B']).toContain(finalTicket?.redeemed_by);
})