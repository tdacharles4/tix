import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Called by the organizer's store before redirecting the customer to checkout.
// Returns a short-lived single-use token.
// Body: { eventId, ticketTypeConfigId?, quantity }
export async function POST(req: NextRequest) {
  try {
    const { eventId, ticketTypeConfigId, quantity = 1 } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify event exists and is live
    const { data: event } = await supabase
      .from('events')
      .select('id, status')
      .eq('id', eventId)
      .single();

    if (!event || event.status !== 'live') {
      return NextResponse.json({ error: 'Event not available' }, { status: 404 });
    }

    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .insert({
        event_id:              eventId,
        ticket_type_config_id: ticketTypeConfigId ?? null,
        quantity:              Number(quantity),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const checkoutUrl = `${appUrl}/checkout/${eventId}?token=${session.id}`;

    return NextResponse.json({ token: session.id, checkoutUrl, expiresAt: session.expires_at });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

// Validates a token — called by the checkout page on mount.
export async function GET(req: NextRequest) {
  const token   = req.nextUrl.searchParams.get('token');
  const eventId = req.nextUrl.searchParams.get('eventId');

  if (!token || !eventId) {
    return NextResponse.json({ valid: false, reason: 'Missing params' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: session } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('id', token)
    .eq('event_id', eventId)
    .single();

  if (!session)                              return NextResponse.json({ valid: false, reason: 'Token not found' });
  if (session.used)                          return NextResponse.json({ valid: false, reason: 'Token already used' });
  if (new Date(session.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'Token expired' });

  return NextResponse.json({
    valid:               true,
    quantity:            session.quantity,
    ticketTypeConfigId:  session.ticket_type_config_id,
  });
}
