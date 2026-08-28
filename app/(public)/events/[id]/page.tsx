'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMXN, formatDate } from '@/lib/utils';
import type { TicketTypeConfig } from '@/lib/supabase/types';

type TicketOption = {
  id: string;
  phaseName: string;
  name: string;
  price_mxn: number;
  quantity: number;
  sold: number;
};

type EventData = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  end_time: string | null;
  venue: string | null;
  venue_url: string | null;
  destination: string | null;
  destination_url: string | null;
  location_type: string;
  presencial_type: string | null;
  cover_image_url: string | null;
  capacity: number;
  tickets_sold: number;
  price_mxn: number;
  max_tickets_per_order: number;
};

const MAX_TICKETS_HARD_CAP = 6;

export default function PublicEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventData | null>(null);
  const [ticketOptions, setTicketOptions] = useState<TicketOption[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: ev } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('status', 'live')
        .single();

      if (!ev) { setNotFound(true); setLoading(false); return; }
      setEvent(ev);

      // Load ticket phases and configs
      const { data: phases } = await supabase
        .from('ticket_phases')
        .select('*, ticket_type_configs(*)')
        .eq('event_id', id)
        .order('position');

      if (phases) {
        const options: TicketOption[] = [];
        for (const phase of phases) {
          // Check if phase is still active
          if (phase.end_date && new Date(phase.end_date) < new Date()) continue;

          const configs = (phase.ticket_type_configs ?? []) as unknown as TicketTypeConfig[];
          for (const tc of configs) {
            // Count sold tickets for this config
            const { count } = await supabase
              .from('tickets')
              .select('*', { count: 'exact', head: true })
              .eq('ticket_type_config_id', tc.id)
              .neq('status', 'cancelled');

            const sold = count ?? 0;
            const remaining = tc.quantity - sold;

            // Skip if sold out and phase has end_on_sold_out
            if (remaining <= 0 && phase.end_on_sold_out) continue;

            options.push({
              id: tc.id,
              phaseName: phase.name,
              name: tc.name,
              price_mxn: tc.price_mxn,
              quantity: tc.quantity,
              sold,
            });
          }
        }
        setTicketOptions(options);
        if (options.length > 0) setSelectedTicket(options[0].id);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  const selected = ticketOptions.find((t) => t.id === selectedTicket);
  const remaining = selected ? selected.quantity - selected.sold : 0;
  const soldOut = !selected || remaining <= 0;
  const maxQty = Math.min(
    MAX_TICKETS_HARD_CAP,
    event?.max_tickets_per_order ?? MAX_TICKETS_HARD_CAP,
    remaining,
  );

  async function handleBuy() {
    if (!selected || soldOut) return;
    setBuying(true);
    setError('');

    try {
      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: id,
          ticketTypeConfigId: selected.id,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al iniciar la compra'); setBuying(false); return; }
      router.push(data.checkoutUrl);
    } catch {
      setError('Error de conexión');
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando evento…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
        <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <span className="text-gray-500 text-2xl">?</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Evento no encontrado</h1>
        <p className="text-gray-400 text-sm">Este evento no existe o no está disponible.</p>
      </div>
    );
  }

  if (!event) return null;

  const globalAvailable = event.capacity - event.tickets_sold;
  const globalSoldOut = globalAvailable <= 0;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero / Flyer */}
      {event.cover_image_url && (
        <div className="w-full max-h-[400px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Event info */}
        <h1 className="text-3xl font-bold text-white mb-2">{event.title}</h1>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mb-6">
          {event.date && <span>{formatDate(event.date)}</span>}
          {event.end_time && (
            <span>— {formatDate(event.end_time)}</span>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-4">
          {/* Location */}
          {event.venue && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {event.presencial_type === 'origen_destino' ? 'Origen' : 'Lugar'}
              </p>
              {event.venue_url ? (
                <a href={event.venue_url} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline">{event.venue}</a>
              ) : (
                <p className="text-white">{event.venue}</p>
              )}
            </div>
          )}
          {event.destination && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Destino</p>
              {event.destination_url ? (
                <a href={event.destination_url} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline">{event.destination}</a>
              ) : (
                <p className="text-white">{event.destination}</p>
              )}
            </div>
          )}
          {event.location_type === 'en_linea' && (
            <p className="text-gray-400 text-sm">Evento en línea</p>
          )}
          {event.location_type === 'tba' && (
            <p className="text-gray-400 text-sm">Lugar por confirmar</p>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Acerca del evento</p>
              <p className="text-gray-300 text-sm whitespace-pre-line">{event.description}</p>
            </div>
          )}
        </div>

        {/* Ticket selection */}
        {globalSoldOut ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-lg font-semibold text-white mb-1">Agotado</p>
            <p className="text-sm text-gray-400">Ya no hay boletos disponibles para este evento.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Boletos</h2>

            {ticketOptions.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay boletos disponibles en este momento.</p>
            ) : (
              <>
                {/* Ticket type cards */}
                <div className="space-y-2">
                  {ticketOptions.map((opt) => {
                    const rem = opt.quantity - opt.sold;
                    const isSoldOut = rem <= 0;
                    const isSelected = selectedTicket === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => { setSelectedTicket(opt.id); setQuantity(1); }}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          isSoldOut
                            ? 'border-gray-800 bg-gray-800/50 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'border-indigo-500 bg-indigo-900/20'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium text-sm">
                              {opt.phaseName} — {opt.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {isSoldOut ? 'Agotado' : `${rem} disponible${rem === 1 ? '' : 's'}`}
                            </p>
                          </div>
                          <p className="text-white font-semibold">
                            {opt.price_mxn === 0 ? 'Gratis' : formatMXN(opt.price_mxn)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quantity + Buy */}
                {!soldOut && (
                  <div className="flex items-end gap-4 pt-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Cantidad</label>
                      <select
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleBuy}
                      disabled={buying}
                      className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {buying ? 'Procesando…' : `Comprar ${selected && selected.price_mxn > 0 ? formatMXN(selected.price_mxn * quantity) : ''}`}
                    </button>
                  </div>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          Venta de boletos por tix
        </p>
      </div>
    </div>
  );
}
