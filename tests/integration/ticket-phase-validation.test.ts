import { it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);

let userId: string;
let eventId: string;
let config2Id: string; // type at cap
let config3Id: string; // valid purchase
let config4Id: string; // phase past end_date
let config5Id: string; // end_on_sold_out
let config6Id: string; // concurrency

beforeAll(async () => {
    // Crear mock organizer user
    const { data: u, error: uErr } = await supabase.auth.admin.createUser({
        email: `organizer-${Date.now()}@test.local`,
        password: 'test123',
        email_confirm: true
    })
    if(uErr) throw uErr;
    userId = u.user.id;

    // Crear mock event
    const { data: e, error: eErr } = await supabase
        .from('events')
        .insert({
            organizer_id: userId,
            title: 'Phase Validation Integration Tests',
            capacity: 100,
            price_mxn: 100,
            status: 'live',
            max_tickets_per_order: 4
        })
        .select().single();
    if(eErr) throw eErr;
    eventId = e.id;

    // Crear mock phases y ticket types para cada caso

    // Caso 2: Tipo de boleto agotado/ya vendido
        // Generar mock phase Fase 2
    const { data: p2 } = await supabase.from('ticket_phases').insert({
        event_id: eventId,
        name: 'Fase 2'
    }).select().single();
        // Generar mock ticket type General
    const { data: c2 } = await supabase.from('ticket_type_configs').insert({
        phase_id: p2.id,
        event_id: eventId,
        name: 'General',
        price_mxn: 100,
        quantity: 1
    }).select().single();
        // Stash id de mock ticket type General
    config2Id = c2.id;
        // Update vendidos = cantidad, boletos ahora agotados.
    await supabase.from('ticket_type_configs').update({tickets_sold:1}).eq('id',config2Id);

    // Caso 3: Compra valida
    const { data: p3 } = await supabase.from('ticket_phases').insert({
        event_id: eventId,
        name: 'Fase 3'
    }).select().single();
    const { data: c3 } = await supabase.from('ticket_type_configs').insert({
        phase_id: p3.id,
        event_id: eventId,
        name: 'General',
        price_mxn: 100,
        quantity: 5
    }).select().single();
    config3Id = c3.id;
    
    // Caso 4: Fase cerrada por fecha
    const { data: p4 } = await supabase.from('ticket_phases').insert({
        event_id: eventId,
        name: 'Fase 4',
        end_date: '2020-01-01'
    }).select().single();
    const { data: c4 } = await supabase.from('ticket_type_configs').insert({
        phase_id: p4.id,
        event_id: eventId,
        name: 'General',
        price_mxn: 100,
        quantity: 100
    }).select().single();
    config4Id = c4.id;

    // Caso 5: Finalizar una fase cuando se acaban los boletos
    const { data: p5 } = await supabase.from('ticket_phases').insert({
        event_id: eventId,
        name: 'Fase 5',
        end_on_sold_out: true
    }).select().single();
    const { data: c5 } = await supabase.from('ticket_type_configs').insert({
        phase_id: p5.id,
        event_id: eventId,
        name: 'General',
        price_mxn: 100,
        quantity: 5
    }).select().single();
    config5Id = c5.id;
    await supabase.from('ticket_type_configs').update({tickets_sold:5}).eq('id',config5Id);

    // Caso 6: Concurrencia
    const { data: p6 } = await supabase.from('ticket_phases').insert({
        event_id: eventId,
        name: 'Fase 6'
    }).select().single();
    const { data: c6 } = await supabase.from('ticket_type_configs').insert({
        phase_id: p6.id,
        event_id: eventId,
        name: 'General',
        price_mxn: 100,
        quantity: 1
    }).select().single();
    config6Id = c6.id;
})

afterAll(async () => {
    if(eventId) await supabase.from('orders').delete().eq('event_d', eventId);
    if(eventId) await supabase.from('events').delete().eq('id', eventId);
    if(userId){
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.auth.admin.deleteUser(userId);
    }
})

function rpcArgs(configId: string | null, quantity = 1){
    return{
        p_event_id:                 eventId,
        p_quantity:                 quantity,
        p_buyer_id:                 null,
        p_buyer_email:              'b@test.local',
        p_buyer_name:               'Buyer',
        p_platform_fee:             10,
        p_ticket_type_config_id:    configId
    }
}

it('eventos sin fase no requieren configId', async() => {
    const {data,error} = await supabase.rpc('reserve_tickets', rpcArgs(null));
    expect(error).toBeNull();
    expect(typeof data).toBe('string');
})

it('tipo de boleto agotado', async () => {
    const {data,error} = await supabase.rpc('reserve_tickets', rpcArgs(config2Id));
    expect(data).toBeNull;
    expect(error?.message).toBe('Not enough tickets available for this ticket type');
})

it('compra valida regresa order id', async () => {
    const {data,error} = await supabase.rpc('reserve_tickets', rpcArgs(config3Id, 2));
    expect(error).toBeNull;
    expect(typeof data).toBe('string');
});
it('compra valida incrementa tickets_sold', async () => {
    const {data} = await supabase
        .from('ticket_type_configs')
        .select('tickets_sold')
        .eq('id', config3Id)
        .single();
    expect(data?.tickets_sold).toBe(2);
});

it('fase cierra por fecha', async () => {
    const {data,error} = await supabase.rpc('reserve_tickets', rpcArgs(config4Id));
    expect(data).toBeNull;
    expect(error?.message).toBe('This phase has closed');
});

// Caso 5 no lanza 'This phase has closed' porque el check va en orden 
// Boleto (not enough tickets) > Fase (phase has closed) > Evento 
it('rechaza cuando fase agota existencias', async () => {
    const {data,error} = await supabase.rpc('reserve_tickets', rpcArgs(config5Id));
    expect(data).toBeNull;
    expect(error?.message).toBe('Not enough tickets available for this ticket type');
});

it('Solo 1 de 2 compras simultaneas pasa', async () => {
    const [a,b] = await Promise.all([
        supabase.rpc('reserve_tickets', rpcArgs(config6Id)),
        supabase.rpc('reserve_tickets', rpcArgs(config6Id))
    ]);
    const winners = [a,b].filter(r => r.error === null);
    expect(winners).toHaveLength(1);
});
it('tickets_sold es 1 despues de 2 compras simultaneas', async () => {
    const {data} = await supabase
        .from('ticket_type_configs')
        .select('tickets_sold')
        .eq('id',config6Id)
        .single();
    expect(data?.tickets_sold).toBe(1);
})
