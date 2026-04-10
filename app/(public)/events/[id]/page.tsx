import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMXN, formatDate } from '@/lib/utils';

type Props = { params: Promise<{ id: string }> };

export default async function PublicEventPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('status', 'live')
    .single();

  if (!event) notFound();

  const available = event.capacity - event.tickets_sold;
  const soldOut = available <= 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
      <p className="text-gray-500 text-sm mb-6">{formatDate(event.date)}</p>

      <div className="border border-gray-200 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lugar</p>
            <p className="text-gray-900">{event.venue}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Precio</p>
            <p className="text-gray-900 font-semibold">{formatMXN(event.price_mxn)}</p>
          </div>
        </div>

        {event.description && (
          <p className="text-gray-600 text-sm whitespace-pre-line">{event.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {soldOut ? 'Sin disponibilidad' : `${available} boleto${available === 1 ? '' : 's'} disponible${available === 1 ? '' : 's'}`}
        </p>

        {soldOut ? (
          <button disabled className="bg-gray-200 text-gray-400 px-6 py-3 rounded-lg font-medium cursor-not-allowed">
            Agotado
          </button>
        ) : (
          <Link
            href={`/checkout/${event.id}`}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            Comprar boleto
          </Link>
        )}
      </div>
    </div>
  );
}
