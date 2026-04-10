import { createServiceClient } from './supabase/server';

const PLATFORM_FEE = Number(process.env.PLATFORM_FEE_FLAT_MXN ?? 20);
const PENDING_TIMEOUT_MINUTES = 10;

export function getPlatformFee(quantity: number): number {
  return PLATFORM_FEE * quantity;
}

/**
 * Atomically checks capacity and reserves tickets for an event.
 * Uses SELECT FOR UPDATE to prevent double-booking under concurrent checkouts.
 * Returns the created order id (status: pending).
 */
export async function lockInventory(
  eventId: string,
  quantity: number,
  buyerId: string|null,
  buyerEmail: string,
  buyerName: string
): Promise<string> {
  const supabase = createServiceClient();

  // Postgres transaction via RPC
  const { data, error } = await supabase.rpc('reserve_tickets', {
    p_event_id: eventId,
    p_quantity: quantity,
    p_buyer_id: buyerId,
    p_buyer_email: buyerEmail,
    p_buyer_name: buyerName,
    p_platform_fee: getPlatformFee(quantity),
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Inventory lock failed — no order returned');

  return data as string;
}

/**
 * Cancels orders that have been stuck in `pending` for more than PENDING_TIMEOUT_MINUTES
 * and releases the reserved inventory. Call this from a cron job or on checkout start.
 */
export async function cleanupStalePendingOrders(): Promise<void> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000).toISOString();

  // Fetch stale pending orders
  const { data: staleOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, event_id, quantity')
    .eq('status', 'pending')
    .lt('created_at', cutoff);

  if (fetchError) throw fetchError;
  if (!staleOrders?.length) return;

  for (const order of staleOrders) {
    // Decrement tickets_sold to release inventory
    await supabase.rpc('release_inventory', {
      p_event_id: order.event_id,
      p_quantity: order.quantity,
    });

    await supabase
      .from('orders')
      .update({ status: 'failed' })
      .eq('id', order.id);
  }
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(dateString));
}
