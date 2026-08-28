import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const SESSION_TTL_MS = 15 * 60_000; // 15 minutes
const MAX_TICKETS_HARD_CAP = 6;

// Called by the public event page when a buyer clicks "Comprar".
// Creates a short-lived single-use checkout session.
// Body: { eventId, ticketTypeConfigId?, quantity }
export async function POST(req: NextRequest) {
  try {
    const { eventId, ticketTypeConfigId, quantity = 1 } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_TICKETS_HARD_CAP) {
      return NextResponse.json(
        { error: `Cantidad inválida. Máximo ${MAX_TICKETS_HARD_CAP} boletos.` },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Verify event exists and is live
    const { data: event } = await supabase
      .from('events')
      .select('id, status, max_tickets_per_order')
      .eq('id', eventId)
      .single();

    if (!event || event.status !== 'live') {
      return NextResponse.json({ error: 'Event not available' }, { status: 404 });
    }

    const cap = Math.min(MAX_TICKETS_HARD_CAP, event.max_tickets_per_order);
    if (qty > cap) {
      return NextResponse.json(
        { error: `El máximo solicitado excede el límite del evento (${cap}).` },
        { status: 400 },
      );
    }

    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .insert({
        event_id: eventId,
        ticket_type_config_id: ticketTypeConfigId ?? null,
        max_quantity: qty,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        used: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const origin = req.nextUrl.origin;
    const checkoutUrl = `${origin}/checkout/${eventId}?token=${session.id}`;

    return NextResponse.json({
      token: session.id,
      checkoutUrl,
      expiresAt: session.expires_at,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}

// Validates a token — called by the checkout page on mount.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
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

  if (!session) return NextResponse.json({ valid: false, reason: 'Token not found' });
  if (session.used) return NextResponse.json({ valid: false, reason: 'Token already used' });
  if (new Date(session.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'Token expired' });

  return NextResponse.json({
    valid: true,
    quantity: session.max_quantity,
    ticketTypeConfigId: session.ticket_type_config_id,
    expiresAt: session.expires_at,
  });
}
