'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type ScanResult =
  | { valid: true; ticket: Record<string, unknown>; event: Record<string, unknown>; buyer: Record<string, unknown> }
  | { valid: false; reason: string }
  | null;

export default function CheckinPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrcodeRef = useRef<any>(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [lastScanned, setLastScanned] = useState('');

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

  async function startScanner() {
    // Dynamically import to avoid SSR issues (html5-qrcode uses browser APIs)
    const { Html5Qrcode } = await import('html5-qrcode');

    const html5Qrcode = new Html5Qrcode('qr-reader');
    html5QrcodeRef.current = html5Qrcode;
    setScanning(true);
    setResult(null);

    await html5Qrcode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText: string) => {
        // Avoid re-processing the same scan immediately
        if (decodedText === lastScanned) return;
        setLastScanned(decodedText);

        try {
          const res = await fetch(`/api/tickets/${decodedText}/validate`, {
            method: 'POST',
          });
          const data = await res.json();
          setResult(data);
        } catch {
          setResult({ valid: false, reason: 'Error de conexión' });
        }
      },
      () => { /* ignore QR parse errors between frames */ }
    );
  }

  async function stopScanner() {
    if (html5QrcodeRef.current) {
      await html5QrcodeRef.current.stop();
      html5QrcodeRef.current = null;
    }
    setScanning(false);
  }

  function handleScanAnother() {
    setResult(null);
    setLastScanned('');
  }

  const resultBg = result?.valid
    ? 'bg-green-50 border-green-300'
    : 'bg-red-50 border-red-300';

  const reasonLabels: Record<string, string> = {
    already_redeemed: 'Ya fue canjeado',
    cancelled: 'Boleto cancelado',
    transferred: 'Boleto transferido',
    not_found: 'Boleto no encontrado',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Check-in</p>
        <h1 className="text-lg font-semibold">{eventTitle || 'Cargando…'}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {/* QR Scanner container */}
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
            className="border border-gray-600 text-gray-300 px-6 py-2 rounded-xl text-sm hover:bg-gray-800"
          >
            Detener
          </button>
        )}

        {/* Result card */}
        {result && (
          <div className={`w-full max-w-xs border rounded-xl p-5 ${resultBg}`}>
            {result.valid ? (
              <div className="text-gray-900">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-bold text-green-800 text-lg">Válido</span>
                </div>
                <p className="font-semibold text-gray-800">
                  {String((result.buyer as Record<string, unknown>).full_name ?? (result.ticket as Record<string, unknown>).buyer_email ?? '')}
                </p>
                <p className="text-sm text-gray-600">{String((result.ticket as Record<string, unknown>).ticket_type ?? '')}</p>
                {Boolean((result.ticket as Record<string, unknown>).seat_label) && (
                  <p className="text-sm text-gray-600">Asiento: {String((result.ticket as Record<string, unknown>).seat_label)}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-red-800">No válido</p>
                  <p className="text-sm text-red-700">
                    {reasonLabels[result.reason] ?? result.reason}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleScanAnother}
              className="mt-4 w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-100"
            >
              Escanear otro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
