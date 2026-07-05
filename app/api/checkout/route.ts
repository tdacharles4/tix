import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformFee } from '@/lib/utils';
import { lockInventory } from '@/lib/inventory';
import { calculateStripeFees } from '@/lib/stripe/fees';
import { stripe } from '@/lib/stripe/client';

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

    const cap = Math.min(session.max_quantity, event.max_tickets_per_order);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > cap) {
      return NextResponse.json(
        { error: `Cantidad invalida. Maximo ${cap} boletos.`},
        { status: 400 },
      )
    }

    let ticketTypeName = 'General';
    let unitPriceOverride: number | undefined;

    if (session.ticket_type_config_id) {
      const { data: tc } = await supabase
        .from('ticket_type_configs')
        .select('name, price_mxn')
        .eq('id', session.ticket_type_config_id)
        .single();
      if (tc) {
        ticketTypeName = tc.name;
        unitPriceOverride = tc.price_mxn;
      }
    }

    // Calculate fee before lockInventory so the RPC receives the real value
    const unitPrice   = unitPriceOverride ?? event.price_mxn;
    const platformFee = getPlatformFee(unitPrice, quantity);

    // Reserve inventory atomically via DB function (creates order + updates capacity)
    const orderId = await lockInventory(
      eventId,
      quantity,
      null,
      buyerEmail,
      buyerName,
      unitPriceOverride,
      session.ticket_type_config_id,
      platformFee,
    );

    // Mark session token as used
    await supabase.from('checkout_sessions').update({ used: true }).eq('id', sessionToken);

    const { data: organizer } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', event.organizer_id)
      .single();
    if(!organizer?.stripe_account_id){
      return NextResponse.json(
        { error: 'La cuenta de pagos del organizador no ha sido configurada' },
        { status: 503 }
      );
    }
    const ticketSubtotal         = unitPrice * quantity;
    const ticketSubtotalCentavos = Math.round(ticketSubtotal * 100);
    const platformFeeCentavos    = Math.round(platformFee * 100);

    const { chargeCentavos, stripeFeeCentavos, applicationFeeCentavos } =
      calculateStripeFees(ticketSubtotalCentavos, platformFeeCentavos);
    const names: string[] = Array.isArray(holderNames) ? holderNames : [];

    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeCentavos,
      currency: 'mxn',
      application_fee_amount: applicationFeeCentavos,
      transfer_data: {
        destination: organizer.stripe_account_id,
      },
      metadata: {
        order_id: orderId,
        ticket_type_config_id: session.ticket_type_config_id ?? '',
        holder_names: JSON.stringify(names),
        ticket_type_name: ticketTypeName,
      },
    });

    await supabase
      .from('orders')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        platform_fee_mxn:         platformFee,
        total_mxn:                 chargeCentavos / 100,
      })
      .eq('id', orderId);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      fees: {
        ticketSubtotalMxn: ticketSubtotal,
        platformFeeMxn:     platformFee,
        stripeFeeMxn:       stripeFeeCentavos / 100,
        totalMxn:           chargeCentavos / 100,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Checkout failed' }, { status: 500 });
  }
}
