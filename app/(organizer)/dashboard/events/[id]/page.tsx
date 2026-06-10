import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMXN, formatDate } from '@/lib/utils';
import EventTabs from './EventTabs';
import CheckoutLinkGenerator from './CheckoutLinkGenerator';
import type { PhaseWithTypes } from '@/lib/supabase/types';

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

  const orderIds = [...new Set((tickets ?? []).map((t) => t.order_id))];
  const { data: orders } = orderIds.length
    ? await serviceClient.from('orders').select('id, buyer_name').in('id', orderIds)
    : { data: [] };
  const orderMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o.buyer_name]));

  const { data: phasesData } = await serviceClient
    .from('ticket_phases')
    .select('*, ticket_type_configs(*)')
    .eq('event_id', id)
    .order('position');

  const statusColors: Record<string, string> = {
    active:      'bg-green-100 text-green-700',
    redeemed:    'bg-gray-100 text-gray-600',
    cancelled:   'bg-red-100 text-red-600',
    transferred: 'bg-blue-100 text-blue-700',
    finalizado:  'bg-blue-100 text-blue-700',
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
        <div className="flex gap-2 flex-wrap">
          {ev.status === 'live' && (
            <CheckoutLinkGenerator eventId={id} phases={(phasesData ?? []) as PhaseWithTypes[]} />
          )}
          <Link
            href={`/dashboard/events/${id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Editar
          </Link>
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

      {/* Tabs: Asistentes + Inventario de Boletos */}
      <EventTabs
        eventId={id}
        tickets={tickets ?? []}
        orderMap={orderMap}
        statusColors={statusColors}
        phases={(phasesData ?? []) as PhaseWithTypes[]}
      />
    </div>
  );
}
