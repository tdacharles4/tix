import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyScannerToken } from '@/lib/scanner/jwt';
import { SCANNER_COOKIE } from '@/lib/scanner/cookies';
import { validateAndRedeemTicket } from '@/lib/qr/validate';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  // Validate scanner JWT
  const cookieStore = await cookies();
  const token       = cookieStore.get(SCANNER_COOKIE)?.value;
  const payload     = token ? await verifyScannerToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify this event belongs to the scanner's organizer
  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .eq('organizer_id', payload.organizer_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const { ticketId } = await req.json();
  if (!ticketId) {
    return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });
  }

  try {
    const result = await validateAndRedeemTicket(
      ticketId,
      eventId,
      `scanner:${payload.scanner_id}`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
