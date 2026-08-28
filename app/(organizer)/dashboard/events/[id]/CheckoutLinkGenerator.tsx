'use client';

import { useState } from 'react';
import type { PhaseWithTypes } from '@/lib/supabase/types';

type Props = {
  eventId: string;
  phases: PhaseWithTypes[];
  maxTicketsPerOrder: number;
};

export default function CheckoutLinkGenerator({ eventId, phases, maxTicketsPerOrder }: Props) {
  const [open,       setOpen]       = useState(false);
  const [phaseIdx,   setPhaseIdx]   = useState(0);
  const [configIdx,  setConfigIdx]  = useState(0);
  const [quantity,   setQuantity]   = useState(1);
  const [generating, setGenerating] = useState(false);
  const [link,       setLink]       = useState('');
  const [copied,     setCopied]     = useState(false);
  const [error,      setError]      = useState('');

  const allConfigs = phases.flatMap((p, pi) =>
    p.ticket_type_configs.map((tc, ci) => ({ label: `${p.name} — ${tc.name}`, pi, ci, tc }))
  );

  const selectedConfig = allConfigs[configIdx]?.tc ?? null;

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setLink('');

    const res = await fetch('/api/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        ticketTypeConfigId: selectedConfig?.id ?? null,
        quantity,
      }),
    });

    const data = await res.json();
    setGenerating(false);

    if (!res.ok) {
      setError(data.error ?? 'Error al generar el enlace.');
      return;
    }

    setLink(data.checkoutUrl);
  }

  function handleCopy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border border-indigo-500/50 text-indigo-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-900/30 transition-colors"
      >
        Generar enlace de compra
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Generar enlace de compra</h2>
          <button onClick={() => { setOpen(false); setLink(''); setError(''); }}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
        </div>

        {/* Ticket type selector */}
        {allConfigs.length > 0 && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tipo de boleto</label>
            <select
              value={configIdx}
              onChange={(e) => setConfigIdx(Number(e.target.value))}
              className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allConfigs.map((c, i) => (
                <option key={i} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Maximo de boletos por compra</label>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Array.from({ length: maxTicketsPerOrder }, (_, i)=> i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Expiry note */}
        <p className="text-xs text-gray-500">El enlace expira en 30 minutos y es de un solo uso.</p>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Generated link */}
        {link && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
            <p className="text-xs text-gray-400 break-all">{link}</p>
            <div className="flex gap-2">
              <button onClick={handleCopy}
                className="flex-1 bg-indigo-600 text-white py-1.5 rounded text-xs font-medium hover:bg-indigo-700">
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="flex-1 border border-gray-700 text-gray-300 py-1.5 rounded text-xs font-medium text-center hover:bg-gray-800">
                Abrir
              </a>
            </div>
          </div>
        )}

        {!link && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? 'Generando…' : 'Generar enlace'}
          </button>
        )}
      </div>
    </div>
  );
}
