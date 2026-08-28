'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Props = { eventId: string; status: string };

const STATUS_CONFIG: Record<string, { label: string; message: string }> = {
  live: {
    label: 'Publicar Evento',
    message:
      'Publicar el evento generará una liga general para compra de boletos y habilitará la compra de boletos.',
  },
  closed: {
    label: 'Cerrar Evento',
    message:
      'Cerrar el evento pausará la compra de boletos. Los boletos existentes seguirán siendo válidos y el evento estará congelado.',
  },
  cancelled: {
    label: 'Cancelar Evento',
    message:
      'Cancelar el evento marcará el evento como cancelado e inhabilitará la compra de boletos. El estado de los boletos ya comprados es responsabilidad del organizador.',
  },
  finalizado: {
    label: 'Finalizar Evento',
    message:
      'Finalizar el evento marcará el evento como finalizado e inhabilitará la compra de boletos. Al marcar este estado el organizador define que este evento ya sucedió. Un evento se marcará como finalizado por si mismo una vez que hayan pasado la fecha y el horario establecidos.',
  },
};

export default function EventStatusActions({ eventId, status }: Props) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  async function handleConfirm() {
    if (!confirmTarget) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: confirmTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al cambiar estado');
        setLoading(false);
        return;
      }
      setConfirmTarget(null);
      router.refresh();
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  }

  const config = confirmTarget ? STATUS_CONFIG[confirmTarget] : null;

  return (
    <>
      {/* Draft → Publicar button */}
      {status === 'draft' && (
        <button
          onClick={() => setConfirmTarget('live')}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Publicar Evento
        </button>
      )}

      {/* Live → dropdown */}
      {status === 'live' && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors flex items-center gap-1.5"
          >
            Editar Estado
            <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
              {(['closed', 'cancelled', 'finalizado'] as const).map((target) => (
                <button
                  key={target}
                  onClick={() => { setDropdownOpen(false); setConfirmTarget(target); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  {STATUS_CONFIG[target].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmTarget && config && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-3">{config.label}</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">{config.message}</p>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setConfirmTarget(null); setError(''); }}
                disabled={loading}
                className="border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Procesando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
