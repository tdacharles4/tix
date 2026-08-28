import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateTicketPDF } from '@/lib/tickets/generate-pdf';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params;
  const supabase = createServiceClient();

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, events(title, date, venue)')
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ev = (ticket as any).events as { title: string; date: string; venue: string | null } | null;

  const pdfBytes = await generateTicketPDF({
    ticketId: ticket.id,
    holderName: ticket.holder_name ?? '',
    ticketType: ticket.ticket_type ?? 'General',
    eventTitle: ev?.title ?? '',
    eventDate: ev?.date ?? null,
    eventVenue: ev?.venue ?? null,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="boleto-${ticketId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
