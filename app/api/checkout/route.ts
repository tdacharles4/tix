import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lockInventory, getPlatformFee } from '@/lib/utils';
import { createConektaOrder } from '@/lib/conekta/client';

export async function POST(req: NextRequest) {
  try {
    const { eventId, quantity, buyerName, buyerEmail, buyerPhone } = await req.json();

    if (!eventId || !quantity || !buyerName || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Authenticate buyer
    const supabase = await createClient();

    // Fetch event details
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('status', 'live')
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found or not available' }, { status: 404 });
    }

    const platformFee = getPlatformFee(quantity);
    const subtotal = event.price_mxn * quantity;
    const totalMxn = subtotal + platformFee;

    // Lock inventory and create pending order
    const orderId = await lockInventory(
      eventId,
      quantity,
      null,
      buyerEmail,
      buyerName
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Create Conekta order (amounts in centavos)
    const conektaOrder = await createConektaOrder({
      currency: 'MXN',
      customer_info: {
        name: buyerName,
        email: buyerEmail,
        phone: buyerPhone,
      },
      line_items: [
        {
          name: event.title,
          unit_price: Math.round(event.price_mxn * 100),
          quantity,
        },
        {
          name: 'Cargo por servicio',
          unit_price: Math.round(platformFee * 100),
          quantity: 1,
        },
      ],
      charges: [
        {
          payment_method: {
            type: 'card',
          },
          amount: Math.round(totalMxn * 100),
        },
      ],
      checkout: {
        type: 'HostedPayment',
        allowed_payment_methods: ['card', 'cash', 'bank_transfer'],
        success_url: `${appUrl}/confirmation/${orderId}`,
        failure_url: `${appUrl}/checkout/${eventId}?error=payment_failed`,
      },
      metadata: {
        order_id: orderId,
        event_id: eventId,
      },
    });

    // Store Conekta order ID on our order
    const { createServiceClient } = await import('@/lib/supabase/server');
    const serviceClient = createServiceClient();
    await serviceClient
      .from('orders')
      .update({ conekta_order_id: conektaOrder.id })
      .eq('id', orderId);

    return NextResponse.json({
      orderId,
      checkoutUrl: conektaOrder.checkout?.url,
      conektaOrderId: conektaOrder.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
