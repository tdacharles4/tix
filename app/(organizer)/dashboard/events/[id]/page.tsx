import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMXN, formatDate } from '@/lib/utils';

type Props = { params: Promise<{ id: string }> };

export default async function OrganizerEventPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const uid = user!.id;

  const serviceClient = createServiceClient();

  const { data: event } = await serviceClient
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', uid)
    .single();

  if (!event) notFound();
  const ev = event!;

  const { data: tickets } = await serviceClient
    .from('tickets')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false });

  // Fetch buyer names from orders separately to avoid join type errors
  const orderIds = [...new Set((tickets ?? []).map((t) => t.order_id))];
  const { data: orders } = orderIds.length
    ? await serviceClient.from('orders').select('id, buyer_name').in('id', orderIds)
    : { data: [] };
  const orderMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o.buyer_name]));

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    redeemed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
    transferred: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Event header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{ev.title}</h1>
          <p className="text-gray-600 text-sm mt-1">{formatDate(ev.date)} · {ev.venue}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/events/${id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Editar
          </Link>
          {/* CSV download */}
          <a
            href={`/api/events/${id}/attendees.csv`}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Descargar CSV
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Vendidos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{ev.tickets_sold}</p>
          <p className="text-xs text-gray-400">de {ev.capacity}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Recaudado</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatMXN(ev.tickets_sold * ev.price_mxn)}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Canjeados</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {tickets?.filter((t) => t.status === 'redeemed').length ?? 0}
          </p>
        </div>
      </div>

      {/* Attendee list */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Asistentes</h2>
      {!tickets?.length ? (
        <p className="text-gray-500 text-sm py-8 text-center">Aún no hay boletos vendidos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 font-semibold text-gray-600">Nombre</th>
                <th className="pb-3 font-semibold text-gray-600">Correo</th>
                <th className="pb-3 font-semibold text-gray-600">Tipo</th>
                <th className="pb-3 font-semibold text-gray-600">Estado</th>
                <th className="pb-3 font-semibold text-gray-600">Canjeado</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                return (
                  <tr key={ticket.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-gray-900">{orderMap[ticket.order_id] ?? '—'}</td>
                    <td className="py-3 text-gray-600">{ticket.buyer_email}</td>
                    <td className="py-3 text-gray-600">{ticket.ticket_type}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">
                      {ticket.redeemed_at
                        ? new Date(ticket.redeemed_at).toLocaleString('es-MX')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
