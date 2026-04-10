'use client';

import type { Event } from '@/lib/supabase/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type EventFormValues = {
  title: string;
  description: string;
  date: string;
  venue: string;
  capacity: string;
  price_mxn: string;
  status: Event['status'];
};

type EventFormProps = {
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  loading?: boolean;
  error?: string;
  submitLabel?: string;
};

export function EventForm({
  defaultValues = {},
  onSubmit,
  loading,
  error,
  submitLabel = 'Guardar',
}: EventFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      date: fd.get('date') as string,
      venue: fd.get('venue') as string,
      capacity: fd.get('capacity') as string,
      price_mxn: fd.get('price_mxn') as string,
      status: (fd.get('status') as Event['status']) ?? 'draft',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Título *"
        name="title"
        required
        defaultValue={defaultValues.title}
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          name="description"
          rows={4}
          defaultValue={defaultValues.description}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Fecha y hora *" name="date" type="datetime-local" required defaultValue={defaultValues.date} />
        <Input label="Lugar *" name="venue" required defaultValue={defaultValues.venue} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Capacidad *" name="capacity" type="number" min={1} required defaultValue={defaultValues.capacity} />
        <Input label="Precio (MXN) *" name="price_mxn" type="number" min={0} step="0.01" required defaultValue={defaultValues.price_mxn} />
      </div>
      {defaultValues.status !== undefined && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Estado</label>
          <select
            name="status"
            defaultValue={defaultValues.status}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="draft">Borrador</option>
            <option value="live">Publicado</option>
            <option value="closed">Cerrado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? 'Guardando…' : submitLabel}</Button>
    </form>
  );
}
