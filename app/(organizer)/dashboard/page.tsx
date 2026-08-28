import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatMXN, formatDate } from '@/lib/utils';
import LogoutButton from './LogoutButton';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');
  const uid = user!.id;

  // Auto-finalize events whose end_time (or date) has passed
  const now = new Date().toISOString();
  await supabase
    .from('events')
    .update({ status: 'finalizado' })
    .eq('organizer_id', uid)
    .in('status', ['draft', 'live'])
    .or(`end_time.lt.${now},and(end_time.is.null,date.lt.${now})`);

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', uid)
    .order('date', { ascending: false });

  const statusColors: Record<string, string> = {
    draft:      'bg-gray-800 text-gray-400',
    live:       'bg-emerald-900/50 text-emerald-400',
    closed:     'bg-amber-900/50 text-amber-400',
    cancelled:  'bg-red-900/50 text-red-400',
    finalizado: 'bg-indigo-900/50 text-indigo-400',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto border-b border-gray-800">
        <Link href="/" className="text-lg font-bold tracking-tight">Climate Control</Link>
        <div className="flex items-center gap-5">
          <Link href="/dashboard/earnings" className="text-sm text-gray-400 hover:text-white transition-colors">
            Ingresos
          </Link>
          <Link href="/dashboard/scanners" className="text-sm text-gray-400 hover:text-white transition-colors">
            Escáneres
          </Link>
          <LogoutButton />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Mis eventos</h1>
          <Link
            href="/dashboard/events/new"
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            + Nuevo evento
          </Link>
        </div>

        {/* Content */}
        {!events?.length ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-400 text-lg mb-3">Aún no tienes eventos.</p>
            <Link
              href="/dashboard/events/new"
              className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              Crea tu primer evento →
            </Link>
          </div>
        ) : (() => {
          const live  = events.filter((e) => e.status === 'live');
          const draft = events.filter((e) => e.status === 'draft');
          const past  = events.filter((e) => !['live', 'draft'].includes(e.status));

          const renderCard = (event: typeof events[number]) => (
            <Link
              key={event.id}
              href={`/dashboard/events/${event.id}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="text-white font-semibold truncate group-hover:text-indigo-400 transition-colors">
                      {event.title}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusColors[event.status]}`}>
                      {event.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {formatDate(event.date)} · {event.venue}
                  </p>
                </div>

                <div className="flex items-center gap-8 flex-shrink-0 ml-6">
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">{event.tickets_sold} / {event.capacity}</p>
                    <p className="text-gray-600 text-xs">vendidos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">{formatMXN(event.price_mxn)}</p>
                    <p className="text-gray-600 text-xs">precio</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          );

          return (
            <div className="space-y-10">
              {live.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                    <h2 className="text-lg font-semibold">En Vivo</h2>
                    <span className="text-sm text-gray-500">{live.length}</span>
                  </div>
                  <div className="grid gap-3">{live.map(renderCard)}</div>
                </section>
              )}

              {draft.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                    <h2 className="text-lg font-semibold">Borradores</h2>
                    <span className="text-sm text-gray-500">{draft.length}</span>
                  </div>
                  <div className="grid gap-3">{draft.map(renderCard)}</div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />
                    <h2 className="text-lg font-semibold">Finalizados</h2>
                    <span className="text-sm text-gray-500">{past.length}</span>
                  </div>
                  <div className="grid gap-3">{past.map(renderCard)}</div>
                </section>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
