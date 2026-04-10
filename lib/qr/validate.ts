import { createServiceClient } from '@/lib/supabase/server';

export type ValidationResult =
  | { valid: true; ticket: Record<string, unknown>; event: Record<string, unknown>; buyer: Record<string, unknown> }
  | { valid: false; reason: 'already_redeemed' | 'cancelled' | 'transferred' | 'not_found' };

export async function validateAndRedeemTicket(
  ticketId: string,
  redeemedBy: string
): Promise<ValidationResult> {
  const supabase = createServiceClient();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, events(*), profiles(*)')
    .eq('id', ticketId)
    .single();

  if (error || !ticket) return { valid: false, reason: 'not_found' };

  if (ticket.status === 'redeemed') return { valid: false, reason: 'already_redeemed' };
  if (ticket.status === 'cancelled') return { valid: false, reason: 'cancelled' };
  if (ticket.status === 'transferred') return { valid: false, reason: 'transferred' };

  const { error: updateError } = await supabase
    .from('tickets')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redeemed_by: redeemedBy,
    })
    .eq('id', ticketId);

  if (updateError) throw updateError;

  return {
    valid: true,
    ticket,
    event: (ticket as Record<string, unknown>).events as Record<string, unknown>,
    buyer: (ticket as Record<string, unknown>).profiles as Record<string, unknown>,
  };
}
