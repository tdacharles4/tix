'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Event, LocationType, PresencialType, Lugar } from '@/lib/supabase/types';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

const LOCATION_TYPES: { id: LocationType; label: string }[] = [
  { id: 'presencial', label: 'Presencial' },
  { id: 'en_linea',   label: 'En línea' },
  { id: 'tba',        label: 'TBA' },
];

const PRESENCIAL_TYPES: { id: PresencialType; label: string }[] = [
  { id: 'lugar_unico',    label: 'Lugar único' },
  { id: 'origen_destino', label: 'Origen-destino' },
];

const STATUS_OPTIONS: { id: Event['status']; label: string }[] = [
  { id: 'draft',      label: 'Borrador' },
  { id: 'live',       label: 'Publicado' },
  { id: 'closed',     label: 'Cerrado' },
  { id: 'cancelled',  label: 'Cancelado' },
  { id: 'finalizado', label: 'Finalizado' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }

function toLocalDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [fetching, setFetching] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [status,      setStatus]      = useState<Event['status']>('draft');

  const [date,      setDate]      = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd,   setTimeEnd]   = useState('');

  const [locationType,   setLocationType]   = useState<LocationType>('presencial');
  const [presencialType, setPresencialType] = useState<PresencialType>('lugar_unico');
  const [venue,          setVenue]          = useState('');
  const [venueUrl,       setVenueUrl]       = useState('');
  const [destination,    setDestination]    = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [savedLugares,   setSavedLugares]   = useState<Lugar[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [{ data: ev }, { data: lugares }] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase.from('lugares').select('*').eq('organizer_id', user.id).order('name'),
      ]);

      if (!ev) { router.push('/dashboard'); return; }

      setTitle(ev.title);
      setDescription(ev.description ?? '');
      setStatus(ev.status);
      setDate(ev.date ? toLocalDate(ev.date) : '');
      setTimeStart(ev.date ? toLocalTime(ev.date) : '');
      setTimeEnd(ev.end_time ? toLocalTime(ev.end_time) : '');
      setLocationType(ev.location_type);
      setPresencialType(ev.presencial_type ?? 'lugar_unico');
      setVenue(ev.venue ?? '');
      setVenueUrl(ev.venue_url ?? '');
      setDestination(ev.destination ?? '');
      setDestinationUrl(ev.destination_url ?? '');
      if (lugares) setSavedLugares(lugares as Lugar[]);
      setFetching(false);
    }
    load();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (locationType === 'presencial' && !venue.trim()) {
      setError(presencialType === 'lugar_unico' ? 'El lugar es requerido.' : 'El origen es requerido.');
      return;
    }
    if (!date) { setError('La fecha es requerida.'); return; }

    setLoading(true);
    const supabase = createClient();

    const primaryDate = new Date(`${date}T${timeStart || '00:00'}`).toISOString();
    const endTime     = timeEnd && date ? new Date(`${date}T${timeEnd}`).toISOString() : null;

    const locationFields =
      locationType !== 'presencial'
        ? { venue: null, venue_url: null, destination: null, destination_url: null, presencial_type: null }
        : presencialType === 'lugar_unico'
        ? { venue: venue.trim(), venue_url: venueUrl.trim() || null, destination: null, destination_url: null, presencial_type: 'lugar_unico' as PresencialType }
        : { venue: venue.trim(), venue_url: venueUrl.trim() || null, destination: destination.trim() || null, destination_url: destinationUrl.trim() || null, presencial_type: 'origen_destino' as PresencialType };

    const { error: dbError } = await supabase
      .from('events')
      .update({
        title,
        description: description || null,
        date: primaryDate,
        end_time: endTime,
        location_type: locationType,
        ...locationFields,
        status,
      })
      .eq('id', id);

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    router.push(`/dashboard/events/${id}`);
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const pillCls  = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  if (fetching) return <div className="p-8 text-gray-500">Cargando…</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar evento</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>

        {/* Date + Times */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
          <DatePicker value={date} onChange={setDate} />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hora de inicio</label>
              <TimePicker value={timeStart} onChange={setTimeStart} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hora de fin</label>
              <TimePicker value={timeEnd} onChange={setTimeEnd} />
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lugar</label>
          <div className="flex gap-1.5 mb-3">
            {LOCATION_TYPES.map(({ id: lid, label }) => (
              <button key={lid} type="button" onClick={() => setLocationType(lid)} className={pillCls(locationType === lid)}>
                {label}
              </button>
            ))}
          </div>

          {locationType === 'presencial' && (
            <div className="space-y-3">
              <div className="flex gap-1.5">
                {PRESENCIAL_TYPES.map(({ id: pid, label }) => (
                  <button key={pid} type="button" onClick={() => setPresencialType(pid)} className={pillCls(presencialType === pid)}>
                    {label}
                  </button>
                ))}
              </div>

              {presencialType === 'lugar_unico' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Lugar *</label>
                    <input type="text" required value={venue} onChange={(e) => setVenue(e.target.value)}
                      list="lugares-venue" autoComplete="off" className={inputCls} />
                    <datalist id="lugares-venue">
                      {savedLugares.map((l) => <option key={l.id} value={l.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">URL de ubicación</label>
                    <input type="url" value={venueUrl} onChange={(e) => setVenueUrl(e.target.value)}
                      placeholder="https://maps.google.com/..." className={inputCls} />
                  </div>
                </div>
              )}

              {presencialType === 'origen_destino' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Origen *</label>
                      <input type="text" required value={venue} onChange={(e) => setVenue(e.target.value)}
                        list="lugares-origen" autoComplete="off" className={inputCls} />
                      <datalist id="lugares-origen">
                        {savedLugares.map((l) => <option key={l.id} value={l.name} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">URL de ubicación (origen)</label>
                      <input type="url" value={venueUrl} onChange={(e) => setVenueUrl(e.target.value)}
                        placeholder="https://maps.google.com/..." className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Destino *</label>
                      <input type="text" required value={destination} onChange={(e) => setDestination(e.target.value)}
                        list="lugares-destino" autoComplete="off" className={inputCls} />
                      <datalist id="lugares-destino">
                        {savedLugares.map((l) => <option key={l.id} value={l.name} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">URL de ubicación (destino)</label>
                      <input type="url" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)}
                        placeholder="https://maps.google.com/..." className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {locationType === 'en_linea' && (
            <p className="text-sm text-gray-400 italic">El evento se realizará en línea.</p>
          )}
          {locationType === 'tba' && (
            <p className="text-sm text-gray-400 italic">El lugar se anunciará próximamente.</p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map(({ id: sid, label }) => (
              <button key={sid} type="button" onClick={() => setStatus(sid)} className={pillCls(status === sid)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button type="button" onClick={() => router.push(`/dashboard/events/${id}`)}
            className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
