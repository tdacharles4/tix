'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { LocationType, PresencialType, Lugar } from '@/lib/supabase/types';
import { DatePicker } from '@/components/ui/date-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { TimePicker } from '@/components/ui/time-picker';

type DateMode = 'unico' | 'intervalo' | 'recurrente' | 'sin_fecha' | 'especiales';
type RecFreq = 'semanal' | 'mensual' | 'otro';

type TicketTypeForm = { id: string; name: string; price: string; quantity: string; enumerateFromOne: boolean; enumerateFrom: string };
type PhaseForm     = { id: string; name: string; endDate: string; endOnSoldOut: boolean; ticketTypes: TicketTypeForm[] };

const DATE_MODES: { id: DateMode; label: string }[] = [
  { id: 'unico',      label: 'Evento único' },
  { id: 'intervalo',  label: 'Intervalo' },
  { id: 'recurrente', label: 'Recurrente' },
  { id: 'especiales', label: 'Fechas especiales' },
  { id: 'sin_fecha',  label: 'Sin fecha' },
];

const LOCATION_TYPES: { id: LocationType; label: string }[] = [
  { id: 'presencial', label: 'Presencial' },
  { id: 'en_linea',   label: 'En línea' },
  { id: 'tba',        label: 'TBA' },
];

const PRESENCIAL_TYPES: { id: PresencialType; label: string }[] = [
  { id: 'lugar_unico',    label: 'Lugar único' },
  { id: 'origen_destino', label: 'Origen-destino' },
];

function MultiCalendar({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (dates: string[]) => void;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  function toggleDate(dateStr: string) {
    onChange(
      selected.includes(dateStr)
        ? selected.filter((d) => d !== dateStr)
        : [...selected, dateStr].sort()
    );
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="border border-gray-700 rounded-lg p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1 text-gray-400 hover:bg-gray-800 rounded text-lg leading-none"
        >
          ‹
        </button>
        <span className="text-sm font-medium capitalize">{monthName}</span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1 text-gray-400 hover:bg-gray-800 rounded text-lg leading-none"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selected.includes(dateStr);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleDate(dateStr)}
              className={`text-xs py-1 rounded ${
                isSelected ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-indigo-400 mt-2 font-medium">
          {selected.length} fecha(s) seleccionada(s)
        </p>
      )}
    </div>
  );
}

function VenueInput({
  id,
  label,
  required,
  value,
  onChange,
  lugares,
  inputCls,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  lugares: Lugar[];
  inputCls: string;
}) {
  const listId = `lugares-${id}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-400 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        autoComplete="off"
        className={inputCls}
      />
      <datalist id={listId}>
        {lugares.map((l) => (
          <option key={l.id} value={l.name} />
        ))}
      </datalist>
    </div>
  );
}

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    capacity: '',
    price_mxn: '',
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // "Paginacion" de form modules creacion de evento, creacion de tickets
  const [step, setStep] = useState<1|2>(1);
  const [showBackAlert,setShowBackAlert] = useState(false);


  // Estados relacionados a la creacion de evento
  const [dateMode, setDateMode] = useState<DateMode>('unico');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recStartDate, setRecStartDate] = useState('');
  const [recFreq, setRecFreq] = useState<RecFreq>('semanal');
  const [recEveryDays, setRecEveryDays] = useState(2);
  const [specialDates, setSpecialDates] = useState<string[]>([]);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('presencial');
  const [presencialType, setPresencialType] = useState<PresencialType>('lugar_unico');
  const [venue, setVenue] = useState('');
  const [venueUrl, setVenueUrl] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [savedLugares, setSavedLugares] = useState<Lugar[]>([]);

  // Estados relacionados a la creacion de tickets
  const [phases, setPhases] = useState<PhaseForm[]>([
    {
      id: '1',
      name: '',
      endDate: '',
      endOnSoldOut: false,
      ticketTypes: [{ id: '1', name: '', price: '', quantity: '', enumerateFromOne: true, enumerateFrom: '' }],
    },
  ]);
  const [maxTicketsPerOrder, setMaxTicketsPerOrder] = useState('');


  useEffect(() => {
    async function loadLugares() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('lugares')
        .select('*')
        .eq('organizer_id', user.id)
        .order('name');
      if (data) setSavedLugares(data as Lugar[]);
    }
    loadLugares();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCoverImage(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    } else {
      setCoverPreview(null);
    }
  }

  function combineDatetime(date: string): string {
    return new Date(`${date}T${timeStart || '00:00'}`).toISOString();
  }

  function getPrimaryDate(): string | null {
    switch (dateMode) {
      case 'unico':      return singleDate ? combineDatetime(singleDate) : null;
      case 'intervalo':  return startDate ? combineDatetime(startDate) : null;
      case 'recurrente': return recStartDate ? combineDatetime(recStartDate) : null;
      case 'sin_fecha':  return null;
      case 'especiales': return specialDates[0] ? combineDatetime(specialDates[0]) : null;
    }
  }

  function getEndDateStr(): string | null {
    switch (dateMode) {
      case 'unico':      return singleDate;
      case 'intervalo':  return endDate || startDate;
      case 'recurrente': return recStartDate;
      case 'especiales': return specialDates[specialDates.length - 1] ?? null;
      default:           return null;
    }
  }

  function handleGoToTickets() {
    setError('');
    if (!form.title.trim()) { setError('Se requiere el titulo.'); return; }
    if (locationType === 'presencial' && !venue.trim()) { setError('Se requiere el lugar.'); return; }
    if (dateMode !== 'sin_fecha' && !getPrimaryDate()) { setError('Seleccione una fecha.'); return; }
    if (dateMode !== 'sin_fecha' && !timeStart) { setError('Se requiere la hora de inicio.'); return; }
    setStep(2);
  }

  function updatePhase(phaseId: string, field: 'name' | 'endDate' | 'endOnSoldOut', value: string | boolean) {
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, [field]: value } : p)));
  }

  function updateTicketType(phaseId: string, ticketId: string, field: 'name' | 'price' | 'quantity' | 'enumerateFromOne' | 'enumerateFrom', value: string | boolean) {
    setPhases((prev) =>
      prev.map((p) =>
        p.id === phaseId
          ? { ...p, ticketTypes: p.ticketTypes.map((t) => (t.id === ticketId ? { ...t, [field]: value } : t)) }
          : p
      )
    );
  }

  async function saveLugarIfNew(name: string, url: string | null, userId: string) {
    if (!name.trim()) return;
    const already = savedLugares.some(
      (l) => l.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (already) return;
    const supabase = createClient();
    await supabase.from('lugares').insert({ organizer_id: userId, name: name.trim(), url: url || null });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (locationType === 'presencial') {
      if (!venue.trim()) {
        setError(presencialType === 'lugar_unico' ? 'El lugar es requerido.' : 'El origen es requerido.');
        return;
      }
      if (presencialType === 'origen_destino' && !destination.trim()) {
        setError('El destino es requerido.');
        return;
      }
    }

    const primaryDate = getPrimaryDate();
    if (dateMode !== 'sin_fecha' && !primaryDate) {
      setError('Por favor selecciona una fecha.');
      return;
    }
    if (dateMode === 'especiales' && specialDates.length === 0) {
      setError('Selecciona al menos una fecha especial.');
      return;
    }

    const allTicketTypes = phases.flatMap((p) => p.ticketTypes);
    const totalCapacity = allTicketTypes.reduce((sum, t) => sum + (parseInt(t.quantity) || 0), 0);
    const basePrice = parseFloat(phases[0]?.ticketTypes[0]?.price || '0');
    const invalidTicket = phases.some((p) => !p.name.trim()) ||
      allTicketTypes.some((t) => !t.name.trim() || t.price.trim() === '' || t.quantity.trim() === '' || parseInt(t.quantity, 10) < 1);
    if (invalidTicket){
      setError('Faltan campos por completar.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    let endTime: string | null = null;
    if (timeEnd) {
      const dateStr = getEndDateStr();
      if (dateStr) endTime = new Date(`${dateStr}T${timeEnd}`).toISOString();
    }

    const locationFields =
      locationType !== 'presencial'
        ? { venue: null, venue_url: null, destination: null, destination_url: null, presencial_type: null }
        : presencialType === 'lugar_unico'
        ? { venue: venue.trim(), venue_url: venueUrl.trim() || null, destination: null, destination_url: null, presencial_type: 'lugar_unico' as PresencialType }
        : { venue: venue.trim(), venue_url: venueUrl.trim() || null, destination: destination.trim() || null, destination_url: destinationUrl.trim() || null, presencial_type: 'origen_destino' as PresencialType };

    // Upload cover image if provided
    let coverImageUrl: string | null = null;
    if (coverImage) {
      const ext = coverImage.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('event-images')
        .upload(path, coverImage, { cacheControl: '3600', upsert: false });
      if (uploadErr) { setError(`Error subiendo imagen: ${uploadErr.message}`); setLoading(false); return; }
      const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(path);
      coverImageUrl = urlData.publicUrl;
    }

    const parsedMaxTickets = parseInt(maxTicketsPerOrder);
    const maxTicketsValue = Number.isNaN(parsedMaxTickets) ? undefined : parsedMaxTickets;
    const { data, error: dbError } = await supabase
      .from('events')
      .insert({
        organizer_id: user.id,
        title: form.title,
        description: form.description || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        date: (primaryDate ?? null) as any,
        end_time: endTime,
        location_type: locationType,
        ...locationFields,
        capacity: totalCapacity,
        price_mxn: basePrice,
        status: 'draft',
        max_tickets_per_order: maxTicketsValue,
        cover_image_url: coverImageUrl,
      })
      .select()
      .single();

    if (dbError) { setError(dbError.message); setLoading(false); return; }

    if (locationType === 'presencial') {
      await saveLugarIfNew(venue, venueUrl, user.id);
      if (presencialType === 'origen_destino' && destination.trim()) {
        await saveLugarIfNew(destination, destinationUrl, user.id);
      }
    }

    // Save phases and ticket type configs
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const { data: phaseData, error: phaseError } = await supabase
        .from('ticket_phases')
        .insert({
          event_id: data.id,
          name: phase.name,
          end_date: phase.endDate || null,
          end_on_sold_out: phase.endOnSoldOut,
          position: i,
        })
        .select()
        .single();
      if (phaseError) { setError(phaseError.message); setLoading(false); return; }

      const { error: ttError } = await supabase
        .from('ticket_type_configs')
        .insert(
          phase.ticketTypes.map((tt) => ({
            phase_id: phaseData.id,
            event_id: data.id,
            name: tt.name,
            price_mxn: parseFloat(tt.price) || 0,
            quantity: parseInt(tt.quantity) || 0,
            enumerate_from: tt.enumerateFromOne ? 1 : parseInt(tt.enumerateFrom) || 1,
          }))
        );
      if (ttError) { setError(ttError.message); setLoading(false); return; }
    }

    router.push(`/dashboard/events/${data.id}`);
  }

  const inputCls = 'w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const pillCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">
          {step === 1 ? 'Nuevo evento' : 'Creación de boletos'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Step 1: Event info ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Título *</label>
                <input name="title" type="text" required value={form.title} onChange={handleChange} className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <textarea name="description" rows={4} value={form.description} onChange={handleChange} className={inputCls} />
              </div>

              {/* Cover image */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Flyer / Imagen de portada</label>
                {coverPreview && (
                  <div className="relative mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPreview} alt="Preview" className="w-full max-h-64 object-cover rounded-lg border border-gray-700" />
                    <button
                      type="button"
                      onClick={() => { setCoverImage(null); setCoverPreview(null); }}
                      className="absolute top-2 right-2 bg-gray-900/80 text-white w-7 h-7 rounded-full text-sm hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 file:cursor-pointer"
                />
              </div>

              {/* Date section */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Fecha</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {DATE_MODES.map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setDateMode(id)} className={pillCls(dateMode === id)}>
                      {label}
                    </button>
                  ))}
                </div>

                {dateMode === 'unico' && (
                  <DatePicker value={singleDate} onChange={setSingleDate} />
                )}

                {dateMode === 'intervalo' && (
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                  />
                )}

                {dateMode === 'recurrente' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Fecha de inicio</label>
                      <DatePicker value={recStartDate} onChange={setRecStartDate} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Frecuencia</label>
                      <div className="flex gap-1.5">
                        {(['semanal', 'mensual', 'otro'] as RecFreq[]).map((f) => (
                          <button key={f} type="button" onClick={() => setRecFreq(f)} className={pillCls(recFreq === f)}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {recFreq === 'otro' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Cada</span>
                        <input
                          type="number"
                          min={1}
                          value={recEveryDays}
                          onChange={(e) => setRecEveryDays(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-400">día(s)</span>
                      </div>
                    )}
                  </div>
                )}

                {dateMode === 'especiales' && (
                  <MultiCalendar selected={specialDates} onChange={setSpecialDates} />
                )}

                {dateMode === 'sin_fecha' && (
                  <p className="text-sm text-gray-400 italic">Este evento no tiene fecha definida.</p>
                )}

                {dateMode !== 'sin_fecha' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Hora de inicio</label>
                      <TimePicker value={timeStart} onChange={setTimeStart} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Hora de fin</label>
                      <TimePicker value={timeEnd} onChange={setTimeEnd} />
                    </div>
                  </div>
                )}
              </div>

              {/* Location section */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Lugar</label>
                <div className="flex gap-1.5 mb-3">
                  {LOCATION_TYPES.map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setLocationType(id)} className={pillCls(locationType === id)}>
                      {label}
                    </button>
                  ))}
                </div>

                {locationType === 'presencial' && (
                  <div className="space-y-3">
                    <div className="flex gap-1.5">
                      {PRESENCIAL_TYPES.map(({ id, label }) => (
                        <button key={id} type="button" onClick={() => setPresencialType(id)} className={pillCls(presencialType === id)}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {presencialType === 'lugar_unico' && (
                      <div className="space-y-2">
                        <VenueInput id="venue" label="Lugar" required value={venue} onChange={setVenue} lugares={savedLugares} inputCls={inputCls} />
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">URL de ubicación</label>
                          <input type="url" value={venueUrl} onChange={(e) => setVenueUrl(e.target.value)} placeholder="https://maps.google.com/..." className={inputCls} />
                        </div>
                      </div>
                    )}

                    {presencialType === 'origen_destino' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <VenueInput id="venue-origen" label="Origen" required value={venue} onChange={setVenue} lugares={savedLugares} inputCls={inputCls} />
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">URL de ubicación (origen)</label>
                            <input type="url" value={venueUrl} onChange={(e) => setVenueUrl(e.target.value)} placeholder="https://maps.google.com/..." className={inputCls} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <VenueInput id="venue-destino" label="Destino" required value={destination} onChange={setDestination} lugares={savedLugares} inputCls={inputCls} />
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">URL de ubicación (destino)</label>
                            <input type="url" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://maps.google.com/..." className={inputCls} />
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
            </>
          )}

          {/* ── Step 2: Phases + Ticket types ── */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Cantidad máxima de boletos por pedido</label>
                <input
                  type="number"
                  min={1}
                  value={maxTicketsPerOrder}
                  onChange={(e) => setMaxTicketsPerOrder(e.target.value)}
                  className={inputCls}
                />
              </div>

              {phases.map((phase, pi) => (
                <div key={phase.id} className="border border-gray-700 rounded-xl p-4 space-y-4 bg-gray-900">

                  {/* Phase header */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide whitespace-nowrap">
                      Fase {pi + 1}
                    </span>
                    <input
                      type="text"
                      value={phase.name}
                      onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
                      placeholder="Nombre de la fase (ej. Preventa, Fase 1...)"
                      className={inputCls}
                    />
                    {phases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPhases((prev) => prev.filter((p) => p.id !== phase.id))}
                        className="text-xs text-red-500 hover:underline whitespace-nowrap"
                      >
                        Eliminar fase
                      </button>
                    )}
                  </div>

                  {/* Phase end condition */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Fecha de fin de fase</label>
                      <input
                        type="date"
                        value={phase.endDate}
                        onChange={(e) => updatePhase(phase.id, 'endDate', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        id={`soldout-${phase.id}`}
                        type="checkbox"
                        checked={phase.endOnSoldOut}
                        onChange={(e) => updatePhase(phase.id, 'endOnSoldOut', e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <label htmlFor={`soldout-${phase.id}`} className="text-xs text-gray-400">
                        Termina al agotar existencias
                      </label>
                    </div>
                  </div>

                  {/* Ticket types inside this phase */}
                  <div className="space-y-3">
                    {phase.ticketTypes.map((tt, ti) => (
                      <div key={tt.id} className="border border-gray-700 rounded-lg p-3 space-y-3 bg-gray-800/50">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-400">Tipo {ti + 1}</span>
                          {phase.ticketTypes.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPhases((prev) =>
                                  prev.map((p) =>
                                    p.id === phase.id
                                      ? { ...p, ticketTypes: p.ticketTypes.filter((t) => t.id !== tt.id) }
                                      : p
                                  )
                                )
                              }
                              className="text-xs text-red-500 hover:underline"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Nombre del boleto *</label>
                          <input
                            type="text"
                            required
                            value={tt.name}
                            onChange={(e) => updateTicketType(phase.id, tt.id, 'name', e.target.value)}
                            placeholder="Ej. General, VIP, Hospitality..."
                            className={inputCls}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Precio (MXN) *</label>
                            <input
                              type="number"
                              required
                              min={0}
                              step="0.01"
                              value={tt.price}
                              onChange={(e) => updateTicketType(phase.id, tt.id, 'price', e.target.value)}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Cantidad *</label>
                            <input
                              type="number"
                              required
                              min={1}
                              value={tt.quantity}
                              onChange={(e) => updateTicketType(phase.id, tt.id, 'quantity', e.target.value)}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <input
                            id={`enumerate-${tt.id}`}
                            type="checkbox"
                            checked={tt.enumerateFromOne}
                            onChange={(e) => updateTicketType(phase.id, tt.id, 'enumerateFromOne', e.target.checked)}
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <label htmlFor={`enumerate-${tt.id}`} className="text-xs text-gray-400">
                            Enumerar a partir de 1
                          </label>
                          {!tt.enumerateFromOne && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-400">Enumerar a partir de:</label>
                              <input
                                type="number"
                                min={1}
                                value={tt.enumerateFrom}
                                onChange={(e) => updateTicketType(phase.id, tt.id, 'enumerateFrom', e.target.value)}
                                className="w-24 border border-gray-700 bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setPhases((prev) =>
                          prev.map((p) =>
                            p.id === phase.id
                              ? { ...p, ticketTypes: [...p.ticketTypes, { id: String(Date.now()), name: '', price: '', quantity: '', enumerateFromOne: true, enumerateFrom: '' }] }
                              : p
                          )
                        )
                      }
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      + Agregar tipo de boleto
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setPhases((prev) => [
                    ...prev,
                    { id: String(Date.now()), name: '', endDate: '', endOnSoldOut: false, ticketTypes: [{ id: String(Date.now() + 1), name: '', price: '', quantity: '', enumerateFromOne: true, enumerateFrom: '' }] },
                  ])
                }
                className="text-sm text-indigo-400 hover:underline"
              >
                + Agregar fase
              </button>
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* ── Buttons ── */}
          <div className="flex gap-3 pt-2">
            {step === 1 ? (
              <button
                type="button"
                onClick={handleGoToTickets}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Ir a creacion de boletos
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Crear evento'}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => setShowBackAlert(true)}
                className="border border-gray-700 text-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-800"
              >
                Regresar a creacion de evento
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="border border-gray-700 text-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* ── Back confirmation modal ── */}
      {showBackAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <p className="text-sm text-gray-300">
              Regresar a creacion de eventos eliminara los cambios realizados en la creacion de boletos.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowBackAlert(false)}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhases([{ id: '1', name: '', endDate: '', endOnSoldOut: false, ticketTypes: [{ id: '1', name: '', price: '', quantity: '', enumerateFromOne: true, enumerateFrom: '' }] }]);
                  setShowBackAlert(false);
                  setStep(1);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
              >
                Regresar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
