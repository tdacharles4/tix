import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const serviceClient = createServiceClient();

  // Verify ownership
  const { data: event } = await serviceClient
    .from('events')
    .select('id, title')
    .eq('id', id)
    .eq('organizer_id', user.id)
    .single();

  if (!event) return new NextResponse('Not Found', { status: 404 });

  const { data: tickets } = await serviceClient
    .from('tickets')
    .select('id, buyer_email, ticket_type, seat_label, status, redeemed_at, created_at, order_id')
    .eq('event_id', id)
    .order('created_at', { ascending: true });

  // Fetch buyer names separately
  const orderIds = [...new Set((tickets ?? []).map((t) => t.order_id))];
  const { data: orders } = orderIds.length
    ? await serviceClient.from('orders').select('id, buyer_name').in('id', orderIds)
    : { data: [] };
  const orderMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o.buyer_name]));

  const rows = [
    ['ID', 'Nombre', 'Correo', 'Tipo', 'Asiento', 'Estado', 'Canjeado', 'Fecha compra'],
    ...(tickets ?? []).map((t) => [
      t.id,
      orderMap[t.order_id] ?? '',
      t.buyer_email,
      t.ticket_type,
      t.seat_label ?? '',
      t.status,
      t.redeemed_at ? new Date(t.redeemed_at).toLocaleString('es-MX') : '',
      new Date(t.created_at).toLocaleString('es-MX'),
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="asistentes-${id}.csv"`,
    },
  });
}
