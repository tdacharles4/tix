'use client';

import { useEffect, useRef } from 'react';

type Props = {
  eventId: string;
  onScan: (ticketId: string) => void;
};

export default function QrCamera({ eventId, onScan }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    let stopped = false; // closure flag survives Strict Mode double-invoke

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return; // cleanup already ran before import resolved

      // Clear div so Strict Mode re-runs start with a clean slate
      const el = document.getElementById('qr-reader');
      if (el) el.innerHTML = '';

      const qr = new Html5Qrcode('qr-reader');
      scannerRef.current = qr;

      qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          qr.stop().catch(() => {}).finally(() => onScan(decodedText));
        },
        () => {}, // ignore per-frame misses
      );
    });

    return () => {
      stopped = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
      const el = document.getElementById('qr-reader');
      if (el) el.innerHTML = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      <p className="text-gray-400 text-sm mb-4 text-center">
        Apunta la cámara al código QR del boleto
      </p>
      {/* html5-qrcode renders the camera feed into this div by ID */}
      <div
        id="qr-reader"
        className="w-full max-w-sm rounded-2xl overflow-hidden border border-gray-700"
        style={{ minHeight: 300 }}
      />
      <p className="text-gray-600 text-xs mt-4 text-center">
        Mantén el código centrado en el recuadro
      </p>
    </div>
  );
}
