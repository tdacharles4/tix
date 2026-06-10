import { verifyTicket, extractTicketId } from '@/lib/qr/sign';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {

    const { token, scannedBy } = await req.json();

    if(!verifyTicket(token)){
        return NextResponse.json({ valid: false, reason: 'invalid_signature' }, { status: 400 });
    }

    const ticketId = extractTicketId(token);
    const supabase = createServiceClient();

    const { data: ticket } = await supabase
        .from('tickets')
        .select('*, events(title)')
        .eq('id', ticketId)
        .single();
    
    if (!ticket) {
        return NextResponse.json({ valid: false, reason: 'not_found'}, { status: 400 });
    }

    if (ticket.status === 'redeemed') {
        return NextResponse.json({
            valid: false,
            reason: 'already_redeemed',
            redeemed_at: ticket?.redeemed_at,
        }, { status: 409 });
    }

    if (ticket.status !== 'active'){
        return NextResponse.json({ valid: false, reason: ticket.status }, { status: 400 });
    }

    await supabase
        .from('tickets')
        .update({ status: 'redeemed', redeemed_at: new Date().toISOString(), redeemed_by: scannedBy })
        .eq('id', ticketId)
        .eq('status', 'active');

    return NextResponse.json({
        valid: true,
        holder_name: ticket.holder_name,
        ticket_type: ticket.ticket_type,
    });
}