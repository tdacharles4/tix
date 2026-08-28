import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';
import { generateQRCode } from '@/lib/qr/generate';
import { resend } from '@/lib/resend/client';
import { TicketEmail } from '@/lib/resend/templates/ticket-email';
import { createElement } from 'react';
import { render } from '@react-email/render';

export async function POST(req: NextRequest){
    const rawBody = await req.text();
    const sig = req.headers.get('stripe-signature');

    if(!sig){
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error('Webhook signature verification failed', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = createServiceClient();

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const pi = event.data.object as Stripe.PaymentIntent;
            await handlePaymentSucceeded(pi, supabase);
            break;
        }
        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled': {
            const pi = event.data.object as Stripe.PaymentIntent;
            await handlePaymentFailed(pi, supabase);
            break;
        }
    }

    return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(
    pi: Stripe.PaymentIntent,
    supabase: ReturnType<typeof createServiceClient>
) {
    const { 
        order_id, 
        ticket_type_config_id, 
        holder_names, 
        ticket_type_name 
    } = pi.metadata;

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();
    if(orderError||!order){
        console.error('Order not found for payment_intent:', pi.id, 'order_id:', order_id);
        return;
    }
    if(order.status==='paid') return;

    const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', order.event_id)
        .single();
    if(!eventData){
        console.error('Event not found for order ', order.id);
        return;
    }
    
    const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'paid'})
        .eq('id', order.id);
    if(updateErr){
        console.error('Failed to update order status ', updateErr);
        return;
    }

    const names: string[] = (()=>{
        try { return JSON.parse(holder_names || '[]'); }
        catch { return []; }
    })();

    const ticketInserts = Array.from({ length: order.quantity }, (_, i) => ({
        order_id:               order.id,
        event_id:               order.event_id,
        buyer_id:               null,
        buyer_email:            order.buyer_email,
        holder_name:            names[i]?.trim() || order.buyer_name,
        ticket_type:            ticket_type_name || 'General',
        ticket_type_config_id:  ticket_type_config_id || null,
        status:                 'active' as const,
    }));

    const { data: tickets, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketInserts)
        .select();
    if(ticketError||!tickets){
        console.error('Ticket inser failed: ', ticketError);
        return;
    }

    for (const ticket of tickets) {
        const qrBase64 = await generateQRCode(ticket.id);
        const qrData = qrBase64.replace(/^data:image\/png;base64,/,'');
        await resend.emails.send({
            from:    'onboarding@resend.dev',
            to:      order.buyer_email,
            subject: `Tu boleto para ${eventData.title}`,
            html: await render(createElement(TicketEmail, {
                event:        eventData,
                ticket,
                buyerName:    order.buyer_name,
                qrCodeBase64: `cid:qr-${ticket.id}`,
            })),
            attachments: [{
                filename:    `qr-${ticket.id}.png`,
                content:     qrData,
                contentType: 'image/png',
                contentId:   `qr-${ticket.id}`,
            }],
        });

        await supabase
            .from('tickets')
            .update({ email_sent_at: new Date().toISOString() })
            .eq('id', ticket.id)
    }
}

async function handlePaymentFailed(
    pi: Stripe.PaymentIntent,
    supabase: ReturnType<typeof createServiceClient>
) {
    const { order_id } = pi.metadata;
    if(!order_id) return;

    const { data: order } = await supabase
        .from('orders')
        .select('event_id, quantity, status')
        .eq('id', order_id)
        .single();
    if(!order || order.status !== 'pending') return;

    await supabase.rpc('release_inventory', {
        p_event_id: order.event_id,
        p_quantity: order.quantity
    });

    await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', order_id);
}