import { createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

const STALE_MINUTES = 30;

export async function releaseStaleOrders(eventId: string) {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

  const { data: staleOrders } = await supabase
    .from('orders')
    .select('id, quantity, stripe_payment_intent_id')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .lt('created_at', cutoff);

  if (!staleOrders?.length) return;

  for (const order of staleOrders) {
    if (order.stripe_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(order.stripe_payment_intent_id);
      } catch {}
    }

    await supabase.rpc('release_inventory', {
      p_event_id: eventId,
      p_quantity: order.quantity,
    });

    await supabase
      .from('orders')
      .update({ status: 'failed' })
      .eq('id', order.id)
      .eq('status', 'pending');
  }
}

export async function lockInventory(
  eventId: string,
  quantity: number,
  buyerId: string | null,
  buyerEmail: string,
  buyerName: string,
  unitPriceOverride?: number,
  ticketTypeConfigId?: string | null,
  platformFee: number = 0,
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('reserve_tickets', {
    p_event_id:     eventId,
    p_quantity:     quantity,
    p_buyer_id:     buyerId,
    p_buyer_email:  buyerEmail,
    p_buyer_name:   buyerName,
    p_platform_fee: platformFee,
    p_unit_price_override: unitPriceOverride ?? null,
    p_ticket_type_config_id: ticketTypeConfigId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
