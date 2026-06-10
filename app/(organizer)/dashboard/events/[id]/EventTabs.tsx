'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Ticket, PhaseWithTypes } from '@/lib/supabase/types';

type Props = {
  eventId: string;
  tickets: Ticket[];
  orderMap: Record<string, string>;
  statusColors: Record<string, string>;
  phases: PhaseWithTypes[];
};

type PhaseStatus = 'activa' | 'proxima' | 'cerrada';

function computePhaseStatuses(phases: PhaseWithTypes[], tickets: Ticket[]): PhaseStatus[] {
  const now = new Date();
  let foundActive = false;

  return phases.map((phase) => {
    if (foundActive) return 'proxima';
    if (phase.end_date && new Date(phase.end_date) < now) return 'cerrada';
    if (phase.end_on_sold_out) {
      const totalQty = phase.ticket_type_configs.reduce((sum, tc) => sum + tc.quantity, 0);
      const sold = tickets.filter(
        (t) => phase.ticket_type_configs.some((tc) => tc.name === t.ticket_type) && t.status !== 'cancelled'
      ).length;
      if (sold >= totalQty) return 'cerrada';
    }
    foundActive = true;
    return 'activa';
  });
}

const statusBadge: Record<PhaseStatus, string> = {
  activa:  'bg-green-100 text-green-700',
  proxima: 'bg-yellow-100 text-yellow-700',
  cerrada: 'bg-gray-100 text-gray-500',
};

const statusLabel: Record<PhaseStatus, string> = {
  activa:  'Activa',
  proxima: 'Próxima',
  cerrada: 'Cerrada',
};

export default function EventTabs({ eventId, tickets, orderMap, statusColors, phases: initialPhases }: Props) {
  const [tab, setTab]               = useState<'asistentes' | 'inventario'>('asistentes');
  const [phases, setPhases]         = useState<PhaseWithTypes[]>(initialPhases);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const phaseStatuses = computePhaseStatuses(phases, tickets);

  function updatePhase(phaseId: string, field: 'name' | 'end_date' | 'end_on_sold_out', value: string | boolean) {
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, [field]: value } : p)));
  }

  function updateConfig(phaseId: string, configId: string, field: 'name' | 'price_mxn' | 'quantity' | 'enumerate_from', value: string | number) {
    setPhases((prev) =>
      prev.map((p) =>
        p.id === phaseId
          ? { ...p, ticket_type_configs: p.ticket_type_configs.map((tc) => (tc.id === configId ? { ...tc, [field]: value } : tc)) }
          : p
      )
    );
  }

  async function handleSavePhase(phaseId: string) {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const supabase = createClient();
    const phase = phases.find((p) => p.id === phaseId)!;

    const { error: phaseError } = await supabase
      .from('ticket_phases')
      .update({ name: phase.name, end_date: phase.end_date, end_on_sold_out: phase.end_on_sold_out })
      .eq('id', phaseId);
    if (phaseError) { setSaveError(phaseError.message); setSaving(false); return; }

    for (const tc of phase.ticket_type_configs) {
      const { error: tcError } = await supabase
        .from('ticket_type_configs')
        .update({ name: tc.name, price_mxn: tc.price_mxn, quantity: tc.quantity, enumerate_from: tc.enumerate_from })
        .eq('id', tc.id);
      if (tcError) { setSaveError(tcError.message); setSaving(false); return; }
    }

    const totalCapacity = phases.flatMap((p) => p.ticket_type_configs).reduce((sum, tc) => sum + tc.quantity, 0);
    const basePrice = phases[0]?.ticket_type_configs[0]?.price_mxn ?? 0;
    await supabase.from('events').update({ capacity: totalCapacity, price_mxn: basePrice }).eq('id', eventId);

    setSaving(false);
    setSaveSuccess(true);
    setEditingId(null);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        <button type="button" onClick={() => setTab('asistentes')} className={tabCls(tab === 'asistentes')}>
          Asistentes
        </button>
        <button type="button" onClick={() => setTab('inventario')} className={tabCls(tab === 'inventario')}>
          Inventario de Boletos
        </button>
      </div>

      {/* ── Asistentes ── */}
      {tab === 'asistentes' && (
        <>
          {!tickets.length ? (
            <p className="text-gray-500 text-sm py-8 text-center">Aún no hay boletos vendidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-3 font-semibold text-gray-600">Folio</th>
                    <th className="pb-3 font-semibold text-gray-600">Nombre</th>
                    <th className="pb-3 font-semibold text-gray-600">Correo</th>
                    <th className="pb-3 font-semibold text-gray-600">Tipo</th>
                    <th className="pb-3 font-semibold text-gray-600">Estado</th>
                    <th className="pb-3 font-semibold text-gray-600">Canjeado</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 font-mono text-xs text-gray-400">{ticket.id.slice(0, 8)}</td>
                      <td className="py-3 text-gray-900">{ticket.holder_name || orderMap[ticket.order_id] || '—'}</td>
                      <td className="py-3 text-gray-600">{ticket.buyer_email}</td>
                      <td className="py-3 text-gray-600">{ticket.ticket_type}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 text-xs">
                        {ticket.redeemed_at ? new Date(ticket.redeemed_at).toLocaleString('es-MX') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Inventario de Boletos ── */}
      {tab === 'inventario' && (
        <div className="space-y-5">
          {!phases.length ? (
            <p className="text-gray-500 text-sm py-8 text-center">Este evento no tiene fases configuradas.</p>
          ) : (
            <>
              {saveSuccess && <p className="text-green-600 text-sm">Cambios guardados.</p>}
              {saveError   && <p className="text-red-600 text-sm">{saveError}</p>}

              {phases.map((phase, pi) => {
                const status    = phaseStatuses[pi];
                const isEditing = editingId === phase.id;

                const phaseTickets = tickets.filter(
                  (t) => phase.ticket_type_configs.some((tc) => tc.name === t.ticket_type) && t.status !== 'cancelled'
                );

                return (
                  <div key={phase.id} className="border border-gray-200 rounded-xl overflow-hidden">

                    {/* Phase header bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-800">
                          Fase {pi + 1} · {phase.name || '—'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[status]}`}>
                          {statusLabel[status]}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : phase.id)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {isEditing ? 'Cancelar' : 'Editar'}
                      </button>
                    </div>

                    <div className="p-4 space-y-4">

                      {/* Read-only view */}
                      {!isEditing && (
                        <>
                          {/* End condition summary */}
                          <p className="text-xs text-gray-500">
                            {phase.end_date
                              ? `Fin: ${new Date(phase.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
                              : 'Sin fecha de fin'}
                            {phase.end_on_sold_out ? ' · Termina al agotar existencias' : ''}
                          </p>

                          {/* Ticket type rows */}
                          <div className="space-y-3">
                            {phase.ticket_type_configs.map((tc) => {
                              const sold = tickets.filter(
                                (t) => t.ticket_type === tc.name && t.status !== 'cancelled'
                              ).length;
                              const pct = tc.quantity > 0 ? Math.round((sold / tc.quantity) * 100) : 0;

                              return (
                                <div key={tc.id}>
                                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span className="font-medium">{tc.name}</span>
                                    <span>{sold} / {tc.quantity} vendidos · ${tc.price_mxn} MXN</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Sold tickets */}
                          {phaseTickets.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2 font-medium">Boletos vendidos</p>
                              <div className="space-y-1.5">
                                {phaseTickets.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                      {t.id.slice(0, 8)}
                                    </span>
                                    <span className="font-medium text-gray-700 truncate">
                                      {orderMap[t.order_id] ?? '—'}
                                    </span>
                                    <span className="text-gray-400 truncate">{t.buyer_email}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Edit mode */}
                      {isEditing && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <label className="text-xs text-gray-500 whitespace-nowrap">Nombre</label>
                            <input
                              type="text"
                              value={phase.name}
                              onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
                              className={inputCls}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Fecha de fin de fase</label>
                              <input
                                type="date"
                                value={phase.end_date ?? ''}
                                onChange={(e) => updatePhase(phase.id, 'end_date', e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                              <input
                                id={`soldout-${phase.id}`}
                                type="checkbox"
                                checked={phase.end_on_sold_out}
                                onChange={(e) => updatePhase(phase.id, 'end_on_sold_out', e.target.checked)}
                                className="w-4 h-4 accent-indigo-600"
                              />
                              <label htmlFor={`soldout-${phase.id}`} className="text-xs text-gray-600">
                                Termina al agotar existencias
                              </label>
                            </div>
                          </div>

                          {phase.ticket_type_configs.map((tc, ti) => (
                            <div key={tc.id} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                              <span className="text-xs font-medium text-gray-500">Tipo {ti + 1}</span>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                                <input
                                  type="text"
                                  value={tc.name}
                                  onChange={(e) => updateConfig(phase.id, tc.id, 'name', e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Precio (MXN)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={tc.price_mxn}
                                    onChange={(e) => updateConfig(phase.id, tc.id, 'price_mxn', parseFloat(e.target.value) || 0)}
                                    className={inputCls}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={tc.quantity}
                                    onChange={(e) => updateConfig(phase.id, tc.id, 'quantity', parseInt(e.target.value) || 0)}
                                    className={inputCls}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Enumerar desde</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={tc.enumerate_from}
                                    onChange={(e) => updateConfig(phase.id, tc.id, 'enumerate_from', parseInt(e.target.value) || 1)}
                                    className={inputCls}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleSavePhase(phase.id)}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
