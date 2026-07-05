import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export async function POST(req: NextRequest){
    const supabase      = await createClient();        // reads session from cookies
    const adminSupabase = createServiceClient();       // service role for DB writes

    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', user.id)
        .single();
    if(!profile) return NextResponse.json({ error: 'Profile not found' }, {status: 404 });

    if(profile.stripe_onboarding_complete){
        return NextResponse.json({ alreadyConnected: true });
    }

    let accountId = profile.stripe_account_id;

    if(!accountId){
        const account = await stripe.accounts.create({
            type: 'express',
            country: 'MX',
            email: user.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            }
        });
        accountId = account.id;

        await adminSupabase
            .from('profiles')
            .update({ stripe_account_id: accountId })
            .eq('id', user.id);
    }

    const accountLink = await stripe.accountLinks.create({
        account: accountId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/connect/return`,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/earnings`,
        type: 'account_onboarding'
    });

    return NextResponse.json({ url: accountLink.url });
}