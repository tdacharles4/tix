import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export async function GET(req: NextRequest) {
    const supabase      = await createClient();
    const adminSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single();

    if (!profile?.stripe_account_id) {
        return NextResponse.json({ error: 'No Stripe account connected' }, { status: 404 });
    }

    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    return NextResponse.json({ url: loginLink.url });
}
