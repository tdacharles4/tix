import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export async function GET(req: NextRequest){
    const supabase      = await createClient();
    const adminSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return NextResponse.redirect(new URL('/', req.url));

    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single();
    if(!profile?.stripe_account_id){
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // DEV RELAXED: only checks charges_enabled. See cowork.md → Before Production Notes.
    if (account.charges_enabled) {
        await adminSupabase
            .from('profiles')
            .update({ stripe_onboarding_complete: true })
            .eq('id', user.id);
        return NextResponse.redirect(
            new URL('/dashboard?stripe=connected', req.url)
        );
    }

    return NextResponse.redirect(
        new URL('/dashboard?stripe=incomplete', req.url)
    );
}