import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServiceClient } from '@/lib/supabase/server';
import { validateAndRedeemTicket } from '@/lib/qr/validate';
import { fakeSupabase } from '@/tests/helpers/fakeSupabase';

vi.mock('@/lib/supabase/server', ()=>({
    createServiceClient: vi.fn(),
}));

describe('validateAndRedeemTicket', ()=>{

    // Pruebas unitarias por estatus de boleto

    beforeEach(()=>{
        vi.clearAllMocks();
    });

    // Boleto valido
    it('returns valid:true when the RPC redeems a row', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: {
                    redeem_ticket: { data: [{ id: 't1', status: 'redeemed' }], error: null },
                },
                from: {
                    tickets: {
                        data: { id: 't1', events: { id: 'e1' }, profiles: { id: 'b1' } },
                        error: null,
                    },
                },
            }) as any,
        );

        const result = await validateAndRedeemTicket('t1','e1','door@example.com');

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.ticket).toEqual({ id: 't1', events: { id: 'e1' }, profiles: { id: 'b1' } });
            expect(result.event).toEqual({ id: 'e1' });
            expect(result.buyer).toEqual({ id: 'b1' });
        }
    });

    // Boleto invalido -- evento incorrecto
    it('returns valid:false reason wrong_event when the ticket belongs to a different event', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: {
                    redeem_ticket: { data: [], error: null },
                },
                from: {
                    tickets: {
                        data: { status: 'active', event_id: 'other-event-id' },
                        error: null,
                    },
                },
            }) as any,
        );

        const result = await validateAndRedeemTicket('t1', 'e1', 'door@example.com');

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toBe('wrong_event');
        }
    });

    // Boleto invalido -- boleto cancelado
    it('returns valid:false reason cancelled when ticket was manually cancelled by organizer', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: {
                    redeem_ticket: { data: [], error: null },
                },
                from: {
                    tickets: {
                        data: { status: 'cancelled', event_id: 'e1' },
                        error: null,
                    },
                },
            }) as any,
        );

        const result = await validateAndRedeemTicket('t1', 'e1', 'door@example.com');

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toBe('cancelled');
        }
    });

    // Boleto invalido -- boleto transferido
    it('returns valid:false reason transferred when ticket no longer belongs to og buyer', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: {
                    redeem_ticket: { data: [], error: null },
                },
                from: {
                    tickets: {
                        data: { status: 'transferred', event_id: 'e1' },
                        error: null,
                    },
                },
            }) as any,
        );

        const result = await validateAndRedeemTicket('t1', 'e1', 'door@example.com');

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toBe('transferred');
        }
    });

    // Boleto invalido -- boleto ya canjeado
    it('returns valid:false reason redeemed when the ticket already has been redeemed', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: {
                    redeem_ticket: { data: [], error: null },
                },
                from: {
                    tickets: {
                        data: { status: 'redeemed', event_id: 'e1' },
                        error: null,
                    },
                },
            }) as any,
        );

        const result = await validateAndRedeemTicket('t1', 'e1', 'door@example.com');

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toBe('redeemed');
        }
    });

    // Boleto invalido -- boleto no existe, no encontrado
    it('returns valid:false reason not_found when no ticket matches the id', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: {
                    redeem_ticket: { data: [], error: null },
                },
                from: {
                    tickets: {
                        data: null,
                        error: null,
                    },
                },
            }) as any,
        );

        const result = await validateAndRedeemTicket('t1', 'e1', 'door@example.com');

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toBe('not_found');
        }
    });

    // Pruebas de integracion RPC Supabase

    it('throws cuando error del RPC', async () => {
        vi.mocked(createServiceClient).mockReturnValue(
            fakeSupabase({
                rpc: { redeem_ticket: { data: null, error: new Error('error en base de datos') } },
            }) as any,
        );

        await expect(
            validateAndRedeemTicket('t1','e1','asd@ejemplo.com'),
        ).rejects.toThrow('error en base de datos');
    });

    it('llama al RPC con argumentos correctos', async () => {
        const fake = fakeSupabase({
            rpc: { redeem_ticket: { data: [{ id: 't1', status: 'redeemed' }], error: null } },
            from: { tickets: { data: { id: 't1', events: {}, profiles: {} }, error: null } },
        });
        vi.mocked(createServiceClient).mockReturnValue(fake as any);

        await validateAndRedeemTicket('t1','e1','asd@ejemplo.com');

        expect(fake.rpc).toHaveBeenCalledWith('redeem_ticket', {
            p_ticket_id: 't1',
            p_event_id: 'e1',
            p_scanned_by: 'asd@ejemplo.com'
        });
    });

});