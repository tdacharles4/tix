import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformFee } from '@/lib/utils';

export async function lockInventory(
  eventId: string,
  quantity: number,
  buyerId: string | null,
  buyerEmail: string,
  buyerName: string,
  unitPriceOverride?: number,
  ticketTypeConfigId?: string | null,
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('reserve_tickets', {
    p_event_id:     eventId,
    p_quantity:     quantity,
    p_buyer_id:     buyerId,
    p_buyer_email:  buyerEmail,
    p_buyer_name:   buyerName,
    p_platform_fee: getPlatformFee(quantity),
    p_unit_price_override: unitPriceOverride ?? null,
    p_ticket_type_config_id: ticketTypeConfigId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
