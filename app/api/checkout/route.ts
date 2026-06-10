import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformFee } from '@/lib/utils';
import { lockInventory } from '@/lib/inventory';
import { randomUUID } from 'crypto';
// import { createConektaOrder } from '@/lib/conekta/client'; // TODO: enable when Conekta is configured

export async function POST(req: NextRequest) {
  try {
    const {
      eventId, quantity, buyerName, buyerEmail, buyerPhone,
      sessionToken, holderNames,
    } = await req.json();

    if (!eventId || !quantity || !buyerName || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Validate checkout session token
    if (!sessionToken) {
      return NextResponse.json({ error: 'Invalid checkout link' }, { status: 403 });
    }

    const { data: session } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionToken)
      .eq('event_id', eventId)
      .single();

    if (!session)                                  return NextResponse.json({ error: 'Invalid checkout link' }, { status: 403 });
    if (session.used)                              return NextResponse.json({ error: 'Este enlace ya fue utilizado' }, { status: 403 });
    if (new Date(session.expires_at) < new Date()) return NextResponse.json({ error: 'El enlace de compra ha expirado' }, { status: 403 });

    // Verify event is live and get ticket type name if applicable
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).eq('status', 'live').single();
    if (!event) return NextResponse.json({ error: 'Event not available' }, { status: 404 });

    let ticketTypeName = 'General';
    if (session.ticket_type_config_id) {
      const { data: tc } = await supabase
        .from('ticket_type_configs')
        .select('name')
        .eq('id', session.ticket_type_config_id)
        .single();
      if (tc) ticketTypeName = tc.name;
    }

    // Reserve inventory atomically via DB function (creates order + updates capacity)
    const orderId = await lockInventory(eventId, quantity, null, buyerEmail, buyerName);

    // Mark session token as used
    await supabase.from('checkout_sessions').update({ used: true }).eq('id', sessionToken);

    // Create ticket rows — the RPC only updates capacity, not individual ticket records
    const names: string[] = Array.isArray(holderNames) ? holderNames : [];
    const ticketInserts = Array.from({ length: quantity }, (_, i) => ({
      id:    randomUUID(),
      order_id: orderId,
      event_id:    eventId,
      buyer_id:    null,
      buyer_email: buyerEmail,
      holder_name: names[i]?.trim() || buyerName,
      ticket_type: ticketTypeName,
      status:      'active' as const,
    }));

    await supabase.from('tickets').insert(ticketInserts);


    /* ── Conekta integration (stubbed — enable when provider is configured) ──
    const platformFee = getPlatformFee(quantity);
    const totalMxn    = event.price_mxn * quantity + platformFee;
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL!;
    const conektaOrder = await createConektaOrder({ ... });
    await supabase.from('orders').update({ conekta_order_id: conektaOrder.id }).eq('id', orderId);
    return NextResponse.json({ orderId, checkoutUrl: conektaOrder.checkout?.url });
    ── end Conekta stub ── */

    // Stub: mark order as paid immediately
    await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);

    return NextResponse.json({ orderId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Checkout failed' }, { status: 500 });
  }
}
