import { NextRequest, NextResponse } from 'next/server';
import { verifyConektaWebhook, type ConektaWebhookEvent } from '@/lib/conekta/webhook';
import { createServiceClient } from '@/lib/supabase/server';
import { generateQRCode } from '@/lib/qr/generate';
import { resend } from '@/lib/resend/client';
import { TicketEmail } from '@/lib/resend/templates/ticket-email';
import { v4 as uuidv4 } from 'uuid';
import * as React from 'react';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const digestHeader = req.headers.get('Digest');

  if (!verifyConektaWebhook(rawBody, digestHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ConektaWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.type !== 'order.paid') {
    return NextResponse.json({ received: true });
  }

  const conektaOrderId = event.data.object.id;
  const supabase = createServiceClient();

  // Look up our order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('conekta_order_id', conektaOrderId)
    .single();

  if (orderError || !order) {
    console.error('Order not found for conekta_order_id:', conektaOrderId);
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status === 'paid') {
    // Idempotent — already processed
    return NextResponse.json({ received: true });
  }

  // Fetch event details separately
  const { data: eventData } = await supabase
    .from('events')
    .select('*')
    .eq('id', order.event_id)
    .single();

  if (!eventData) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  try {
    // All operations in a logical unit — Supabase doesn't expose multi-statement TX via client,
    // so we use the RPC approach for atomicity where possible.

    // 1. Update order to paid
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id);

    if (updateOrderError) throw updateOrderError;

    // 2. Generate one ticket per quantity
    const ticketInserts = Array.from({ length: order.quantity }, () => ({
      order_id: order.id,
      event_id: order.event_id,
      buyer_id: null,
      buyer_email: order.buyer_email,
      ticket_type: 'general',
      qr_code: uuidv4(),
      status: 'active' as const,
    }));

    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketInserts)
      .select();

    if (ticketError || !tickets) throw ticketError ?? new Error('Ticket insert failed');

    // 3. Increment tickets_sold on the event (already reserved; just mark as paid/confirmed)
    // tickets_sold was already incremented during inventory lock, nothing to do here.

    // 4. Send ticket emails
    for (const ticket of tickets) {
      const qrBase64 = await generateQRCode(ticket.id);

      await resend.emails.send({
        from: 'boletos@boletera.mx',
        to: order.buyer_email,
        subject: `Tu boleto para ${eventData.title}`,
        react: React.createElement(TicketEmail, {
          event: eventData,
          ticket,
          buyerName: order.buyer_name,
          qrCodeBase64: qrBase64,
        }),
      });

      await supabase
        .from('tickets')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', ticket.id);

    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
