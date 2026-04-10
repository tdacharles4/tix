import type { Event } from '@/lib/supabase/types';
import Link from 'next/link';
import { formatMXN, formatDate } from '@/lib/utils';

type EventCardProps = { event: Event };

export function EventCard({ event }: EventCardProps) {
  const available = event.capacity - event.tickets_sold;
  const soldOut = available <= 0;

  return (
    <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-gray-900 mb-1">{event.title}</h3>
      <p className="text-xs text-gray-500 mb-2">{formatDate(event.date)}</p>
      <p className="text-sm text-gray-600 mb-1">{event.venue}</p>
      <div className="flex items-center justify-between mt-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{formatMXN(event.price_mxn)}</p>
          <p className="text-xs text-gray-400">
            {soldOut ? 'Agotado' : `${available} disponibles`}
          </p>
        </div>
        {!soldOut && (
          <Link
            href={`/events/${event.id}`}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Ver
          </Link>
        )}
      </div>
    </div>
  );
}
