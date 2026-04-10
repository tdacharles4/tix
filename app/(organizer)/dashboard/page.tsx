import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatMXN, formatDate } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  // user is non-null past this point; redirect() throws so TS needs the assertion
  const uid = user!.id;

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', uid)
    .order('date', { ascending: false });

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    live: 'bg-green-100 text-green-700',
    closed: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mis eventos</h1>
        <Link
          href="/dashboard/events/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + Nuevo evento
        </Link>
      </div>

      {!events?.length ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">Aún no tienes eventos.</p>
          <Link href="/dashboard/events/new" className="text-indigo-600 hover:underline text-sm">
            Crea tu primer evento →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 font-semibold text-gray-600">Evento</th>
                <th className="pb-3 font-semibold text-gray-600">Fecha</th>
                <th className="pb-3 font-semibold text-gray-600 text-right">Vendidos / Cap.</th>
                <th className="pb-3 font-semibold text-gray-600 text-right">Precio</th>
                <th className="pb-3 font-semibold text-gray-600">Estado</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{event.title}</td>
                  <td className="py-3 text-gray-600">{formatDate(event.date)}</td>
                  <td className="py-3 text-right text-gray-700">
                    {event.tickets_sold} / {event.capacity}
                  </td>
                  <td className="py-3 text-right text-gray-700">{formatMXN(event.price_mxn)}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[event.status]}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="text-indigo-600 hover:underline text-xs mr-3"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/dashboard/events/${event.id}/edit`}
                      className="text-gray-500 hover:underline text-xs"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
