import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyScannerToken } from '@/lib/scanner/jwt';
import { SCANNER_COOKIE } from '@/lib/scanner/cookies';

export async function GET(
    req: NextRequest,
    { params }: { params: { eventId: string } }
) {
    const token = cookies().get(SCANNER_COOKIE)?.value;
    const payload = token ? await verifyScannerToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    const { data: event } = await supabase
        .from('events')
        .select('id, organizer_id, title, capacity')
        .eq('id', params.eventId)
        .eq('organizer_id', payload.organizer_id)
        .single();
    if(!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: tickets } = await supabase
        .from('tickets')
        .select('id, holder_name, ticket_type, status, redeemed_at')
        .eq('event_id', params.eventId)
        .in('status', ['active', 'redeemed'])
        .order('holder_name', { ascending: true });

    const total = tickets?.length ?? 0;
    const scanned = tickets?.filter(t => t.status === 'redeemed').length ?? 0;

    return NextResponse.json({
        event: { id: event.id, title: event.title, capacity: event.capacity },
        summary: { total, scanned, remaining: total - scanned },
        tickets: tickets ?? [],
    })
}