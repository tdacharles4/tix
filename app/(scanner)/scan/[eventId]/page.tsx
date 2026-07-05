'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QrCamera = dynamic(() => import('./QrCamera'), { ssr: false });

type Guest = {
  id: string;
  holder_name: string | null;
  ticket_type: string;
  status: 'active' | 'redeemed';
  redeemed_at: string | null;
};

type GuestData = {
  event: { id: string; title: string; capacity: number };
  summary: { total: number; scanned: number; remaining: number };
  tickets: Guest[];
};

type ScanResult =
  | { outcome: 'success'; holderName: string; ticketType: string }
  | { outcome: 'already_scanned' }
  | { outcome: 'wrong_event' }
  | { outcome: 'invalid' };

// ── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ scanned, total }: { scanned: number; total: number }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? scanned / total : 0;
  const arc = pct * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={100} height={100} viewBox="0 0 100 100">
        {/* Background ring */}
        <circle cx={50} cy={50} r={r} fill="none" stroke="#374151" strokeWidth={10} />
        {/* Progress arc */}
        {scanned > 0 && (
          <circle
            cx={50} cy={50} r={r} fill="none"
            stroke="#22c55e" strokeWidth={10}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      {/* Center label */}
      <div className="absolute text-center">
        <p className="text-white text-lg font-bold leading-none">{scanned}</p>
        <p className="text-gray-500 text-xs">/ {total}</p>
      </div>
    </div>
  );
}

// ── Scan Result Overlay ──────────────────────────────────────────────────────
function ScanOverlay({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isSuccess = result.outcome === 'success';
  const isAlready = result.outcome === 'already_scanned';

  const bg    = isSuccess ? 'bg-green-600' : isAlready ? 'bg-amber-500' : 'bg-red-600';
  const icon  = isSuccess ? '✓' : isAlready ? '⚠' : '✕';
  const title =
    isSuccess ? 'Acceso válido' :
    isAlready ? 'Ya fue escaneado' :
    result.outcome === 'wrong_event' ? 'Boleto de otro evento' :
    'QR inválido';

  return (
    <div
      className={`fixed inset-0 ${bg} flex flex-col items-center justify-center z-50`}
      onClick={onDismiss}
    >
      <p className="text-white text-7xl font-bold mb-4">{icon}</p>
      <p className="text-white text-2xl font-bold mb-2">{title}</p>
      {result.outcome === 'success' && (
        <>
          <p className="text-white text-lg opacity-90">{result.holderName}</p>
          <p className="text-white text-sm opacity-70 mt-1">{result.ticketType}</p>
        </>
      )}
      <p className="text-white text-xs opacity-50 mt-8">Toca para continuar</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ScannerEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router      = useRouter();

  const [tab,        setTab]        = useState<'dashboard' | 'camera'>('dashboard');
  const [guestData,  setGuestData]  = useState<GuestData | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraKey,  setCameraKey]  = useState(0); // increment to remount camera after scan
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch guest list
  async function fetchGuests() {
    const res = await fetch(`/api/scanner/${eventId}/guests`);
    if (res.status === 401) { router.push('/scan/login'); return; }
    if (!res.ok) return;
    const data = await res.json();
    setGuestData(data);
  }

  // Poll while on dashboard tab
  useEffect(() => {
    if (tab !== 'dashboard') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchGuests();
    intervalRef.current = setInterval(fetchGuests, 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, eventId]);

  // Handle QR scan result
  async function handleScan(ticketId: string) {
    try {
      const res  = await fetch(`/api/scanner/${eventId}/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticketId }),
      });
      const data = await res.json();

      if (data.valid) {
        const ticket = data.ticket as Record<string, unknown>;
        setScanResult({
          outcome:    'success',
          holderName: (ticket.holder_name as string) ?? 'Titular',
          ticketType: (ticket.ticket_type as string) ?? '',
        });
      } else {
        const reason = data.reason as string;
        setScanResult({
          outcome:
            reason === 'redeemed'  ? 'already_scanned' :
            reason === 'wrong_event' ? 'wrong_event' : 'invalid',
        });
      }
    } catch {
      setScanResult({ outcome: 'invalid' });
    }
  }

  function dismissScanResult() {
    setScanResult(null);
    setCameraKey((k) => k + 1); // remount QrCamera to restart the feed
  }

  // Sorted guest list: redeemed first (newest), then active alphabetically
  const sortedGuests = guestData ? [
    ...guestData.tickets
      .filter(t => t.status === 'redeemed')
      .sort((a, b) => (b.redeemed_at ?? '').localeCompare(a.redeemed_at ?? '')),
    ...guestData.tickets
      .filter(t => t.status === 'active')
      .sort((a, b) => (a.holder_name ?? '').localeCompare(b.holder_name ?? '')),
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Scan result overlay */}
      {scanResult && <ScanOverlay result={scanResult} onDismiss={dismissScanResult} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <button onClick={() => router.push('/scan/events')} className="text-gray-500 text-xs mb-0.5 block">
            ← Eventos
          </button>
          <p className="text-white text-sm font-semibold truncate max-w-[240px]">
            {guestData?.event.title ?? '…'}
          </p>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'dashboard' && (
          <div className="px-4 py-5">
            {!guestData ? (
              <p className="text-gray-500 text-sm text-center py-12">Cargando…</p>
            ) : (
              <>
                {/* Stats row */}
                <div className="flex items-center gap-6 mb-6">
                  <DonutChart scanned={guestData.summary.scanned} total={guestData.summary.total} />
                  <div className="space-y-2">
                    <div>
                      <p className="text-gray-500 text-xs">Escaneados</p>
                      <p className="text-green-400 text-xl font-bold">{guestData.summary.scanned}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Pendientes</p>
                      <p className="text-white text-xl font-bold">{guestData.summary.remaining}</p>
                    </div>
                  </div>
                </div>

                {/* Guest list */}
                <div className="space-y-1">
                  {sortedGuests.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-8">Sin boletos registrados.</p>
                  )}
                  {sortedGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="flex items-center gap-3 py-2.5 border-b border-gray-800"
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          guest.status === 'redeemed' ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {guest.holder_name ?? 'Sin nombre'}
                        </p>
                        <p className="text-gray-500 text-xs">{guest.ticket_type}</p>
                      </div>
                      {guest.redeemed_at && (
                        <p className="text-gray-600 text-xs flex-shrink-0">
                          {new Date(guest.redeemed_at).toLocaleTimeString('es-MX', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'camera' && (
          <QrCamera key={cameraKey} eventId={eventId} onScan={handleScan} />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
            tab === 'dashboard' ? 'text-indigo-400' : 'text-gray-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-medium">Dashboard</span>
        </button>
        <button
          onClick={() => setTab('camera')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
            tab === 'camera' ? 'text-indigo-400' : 'text-gray-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-medium">Cámara</span>
        </button>
      </div>
    </div>
  );
}
