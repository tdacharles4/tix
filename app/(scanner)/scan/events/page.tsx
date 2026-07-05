'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ScannerEvent = {
  id: string;
  title: string;
  date: string;
  venue: string | null;
  tickets_sold: number;
  capacity: number;
};

export default function ScannerEventsPage() {
  const router = useRouter();
  const [events,  setEvents]  = useState<ScannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/scanner/events')
      .then((r) => {
        if (r.status === 401) { router.push('/scan/login'); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => { setError('Error al cargar eventos.'); setLoading(false); });
  }, [router]);

  async function handleLogout() {
    await fetch('/api/scanner/logout', { method: 'POST' });
    router.push('/scan/login');
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <div>
          <p className="text-indigo-400 text-xs tracking-widest uppercase">Boleteo</p>
          <h1 className="text-white text-lg font-bold">Selecciona tu evento</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-500 text-xs hover:text-gray-300 transition-colors"
        >
          Salir
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        {loading && (
          <p className="text-gray-500 text-sm text-center py-12">Cargando eventos…</p>
        )}
        {error && (
          <p className="text-red-400 text-sm text-center py-12">{error}</p>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-base">No hay eventos activos en este momento.</p>
            <p className="text-gray-600 text-sm mt-2">El organizador debe activar un evento primero.</p>
          </div>
        )}
        {!loading && events.length > 0 && (
          <div className="space-y-3">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => router.push(`/scan/${event.id}`)}
                className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-left hover:border-indigo-500 active:bg-gray-700 transition-colors"
              >
                <p className="text-white font-semibold text-base mb-1">{event.title}</p>
                <p className="text-gray-400 text-sm mb-1">{formatDate(event.date)}</p>
                {event.venue && (
                  <p className="text-gray-500 text-sm mb-2">{event.venue}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                    {event.tickets_sold} / {event.capacity} boletos
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
