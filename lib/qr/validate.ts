import { createServiceClient } from '@/lib/supabase/server';
import { verifyTicket, extractTicketId } from '@/lib/qr/sign';

export type ValidationResult =
  | { valid: true; ticket: Record<string, unknown>; event: Record<string, unknown>; buyer: Record<string, unknown> }
  | { valid: false; reason: 'redeemed' | 'cancelled' | 'transferred' | 'not_found' | 'wrong_event' | 'invalid_signature' };

export async function validateAndRedeemTicket(
  scannedToken: string,
  eventId: string,
  redeemedBy: string
): Promise<ValidationResult> {
  // Verify signature — reject forged QR codes
  if (!verifyTicket(scannedToken)) {
    return { valid: false, reason: 'invalid_signature' };
  }
  const ticketId = extractTicketId(scannedToken);
  const supabase = createServiceClient();

  const { data: rows, error } = await supabase.rpc('redeem_ticket', {
    p_ticket_id: ticketId,
    p_event_id: eventId,
    p_scanned_by: redeemedBy,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  const redeemed = rows?.[0];

  if (redeemed) {
    const { data: full } = await supabase
      .from('tickets')
      .select('*, events(*), profiles(*)')
      .eq('id', ticketId)
      .single();

      return {
        valid: true,
        ticket: full ?? redeemed,
        event: (full as Record<string, unknown>)?.events as Record<string, unknown>,
        buyer: (full as Record<string, unknown>)?.profiles as Record<string, unknown>,
      };
  }

  const { data: ticket } = await supabase.from('tickets').select('status, event_id').eq('id', ticketId).single();
  if (!ticket)                          return { valid: false, reason: 'not_found' };
  if (ticket.event_id !== eventId)      return { valid: false, reason: 'wrong_event' }
  if (ticket.status === 'cancelled')    return { valid: false, reason: 'cancelled' };
  if (ticket.status === 'transferred')  return { valid: false, reason: 'transferred' };
  return { valid: false, reason: 'redeemed' };

}