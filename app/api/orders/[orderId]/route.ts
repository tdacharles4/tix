import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { signTicket } from '@/lib/qr/sign';
import QRCode from 'qrcode' ;

export async function GET(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const { orderId } = params;
  const supabase = createServiceClient();

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ data: event }, { data: tickets }] = await Promise.all([
    supabase.from('events').select('title, date, venue').eq('id', order.event_id).single(),
    supabase.from('tickets').select('*').eq('order_id', orderId),
  ]);

  const signedTickets = await Promise.all(
    (tickets??[]).map(async (ticket)=>{
      const token = signTicket(ticket.id);
      const qrImage = await QRCode.toDataURL(token);
      return { ...ticket, qr_image: qrImage };
    })
  );

  return NextResponse.json({ order, event, tickets: signedTickets });
}
