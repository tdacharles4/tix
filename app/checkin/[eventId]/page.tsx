'use client';

import { useEffect, useRef, useState, useCallback, Component, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* ── Error Boundary ─────────────────────────────────────────────────────────── */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center mb-4">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <h1 className="text-lg font-semibold mb-2">Algo salió mal</h1>
          <pre className="text-red-400 text-xs bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-full overflow-auto whitespace-pre-wrap mb-4">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Reiniciar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Types ──────────────────────────────────────────────────────────────────── */
type ScanResult =
  | { valid: true; ticket: Record<string, unknown>; event: Record<string, unknown>; buyer: Record<string, unknown> }
  | { valid: false; reason: string }
  | null;

type FlashState = { color: 'green' | 'red' | 'amber'; label: string; sublabel?: string } | null;

/* ── Main Scanner ───────────────────────────────────────────────────────────── */
function CheckinScanner() {
  const { eventId } = useParams<{ eventId: string }>();
  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrcodeRef = useRef<any>(null);

  const [scanning, setScanning] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [flash, setFlash] = useState<FlashState>(null);
  const processingRef = useRef(false);

  const reasonLabels: Record<string, string> = {
    redeemed: 'Ya fue canjeado',
    already_redeemed: 'Ya fue canjeado',
    cancelled: 'Boleto cancelado',
    transferred: 'Boleto transferido',
    not_found: 'No encontrado',
    wrong_event: 'Otro evento',
    invalid_signature: 'QR inválido',
  };

  useEffect(() => {
    async function loadEvent() {
      const supabase = createClient();
      const { data } = await supabase
        .from('events')
        .select('title')
        .eq('id', eventId)
        .single();
      if (data) setEventTitle(data.title);
    }
    loadEvent();
  }, [eventId]);

  const showFlash = useCallback((result: NonNullable<ScanResult>) => {
    if (result.valid) {
      const name = String(
        (result.buyer as Record<string, unknown>).full_name ??
        (result.ticket as Record<string, unknown>).holder_name ??
        ''
      );
      const type = String((result.ticket as Record<string, unknown>).ticket_type ?? '');
      setFlash({ color: 'green', label: name, sublabel: type });
    } else {
      const isAlready = result.reason === 'redeemed' || result.reason === 'already_redeemed';
      setFlash({
        color: isAlready ? 'amber' : 'red',
        label: isAlready ? 'Ya escaneado' : 'No válido',
        sublabel: reasonLabels[result.reason] ?? result.reason,
      });
    }

    setTimeout(() => {
      setFlash(null);
      setTimeout(() => { processingRef.current = false; }, 300);
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScanner() {
    const { Html5Qrcode } = await import('html5-qrcode');

    const html5Qrcode = new Html5Qrcode('qr-reader');
    html5QrcodeRef.current = html5Qrcode;
    setScanning(true);

    await html5Qrcode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText: string) => {
        if (processingRef.current) return;
        processingRef.current = true;

        try {
          const res = await fetch(`/api/tickets/${decodedText}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId }),
          });
          const data = await res.json();
          if (!res.ok) {
            showFlash({ valid: false, reason: res.status === 401 ? 'No autenticado' : (data.error ?? `Error ${res.status}`) });
          } else {
            showFlash(data);
          }
        } catch {
          showFlash({ valid: false, reason: 'Error de conexión' });
        }
      },
      () => {}
    );
  }

  async function stopScanner() {
    if (html5QrcodeRef.current) {
      try { await html5QrcodeRef.current.stop(); } catch { /* already stopped */ }
      html5QrcodeRef.current = null;
    }
    setScanning(false);
  }

  const flashBg =
    flash?.color === 'green' ? 'bg-green-500' :
    flash?.color === 'amber' ? 'bg-amber-500' :
    flash?.color === 'red'   ? 'bg-red-500' : '';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${flash ? flashBg : 'bg-gray-950'}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <p className="text-xs text-white/60 uppercase tracking-wide">Check-in</p>
        <h1 className="text-lg font-semibold text-white">{eventTitle || 'Cargando…'}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        {/* Flash info — shows above camera during flash */}
        {flash && (
          <div className="text-center">
            <p className="text-white text-xl font-bold">{flash.label}</p>
            {flash.sublabel && <p className="text-white/80 text-sm">{flash.sublabel}</p>}
          </div>
        )}

        {/* QR Scanner — always visible */}
        <div
          id="qr-reader"
          ref={scannerRef}
          className="w-full max-w-xs rounded-xl overflow-hidden bg-black"
          style={{ minHeight: 280 }}
        />

        {!scanning ? (
          <button
            onClick={startScanner}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium text-lg hover:bg-indigo-700 active:scale-95 transition-transform"
          >
            Iniciar escáner
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="border border-white/20 text-white/70 px-6 py-2 rounded-xl text-sm hover:bg-white/10"
          >
            Detener
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Export with Error Boundary ──────────────────────────────────────────────── */
export default function CheckinPage() {
  return (
    <ErrorBoundary>
      <CheckinScanner />
    </ErrorBoundary>
  );
}
