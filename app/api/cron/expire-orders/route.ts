import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest){
    const auth = req.headers.get('authorization');
    if(auth !== `Bearer ${process.env.CRON_SECRET}`){
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: staleOrders } = await supabase
        .from('orders')
        .select('id, stripe_payment_intent_id')
        .eq('status', 'pending')
        .lt('created_at', cutoff)
        .not('stripe_payment_intent_id', 'is', null);
    if(!staleOrders?.length){ return NextResponse.json({ cancelled: 0 })};

    let cancelled = 0;
    for ( const order of staleOrders ) { 
        try {
            await stripe.paymentIntents.cancel(order.stripe_payment_intent_id!);
            cancelled++;
        } catch (err: unknown) {
            const stripeErr = err as { code?: string };
            if(stripeErr.code !== 'payment_intent_unexpected_state') {
                console.error('Failed to cancel PI ', order.stripe_payment_intent_id, err);
            }
        }
    }
    return NextResponse.json({ cancelled, total: staleOrders.length });
}

