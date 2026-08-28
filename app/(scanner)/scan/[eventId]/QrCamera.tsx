'use client';

import { useEffect, useRef } from 'react';

type Props = {
  eventId: string;
  onScan: (ticketId: string) => void;
  disabled?: boolean;
};

export default function QrCamera({ eventId, onScan, disabled }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const processingRef = useRef(false);

  // Sync disabled prop into the processing ref
  useEffect(() => {
    processingRef.current = !!disabled;
  }, [disabled]);

  useEffect(() => {
    let stopped = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;

      const el = document.getElementById('qr-reader');
      if (el) el.innerHTML = '';

      const qr = new Html5Qrcode('qr-reader');
      scannerRef.current = qr;

      qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          if (processingRef.current) return;
          processingRef.current = true;
          onScan(decodedText);
        },
        () => {},
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
      <p className="text-white/60 text-sm mb-4 text-center">
        Apunta la cámara al código QR del boleto
      </p>
      <div
        id="qr-reader"
        className="w-full max-w-sm rounded-2xl overflow-hidden border border-gray-700"
        style={{ minHeight: 300 }}
      />
      <p className="text-white/30 text-xs mt-4 text-center">
        Mantén el código centrado en el recuadro
      </p>
    </div>
  );
}
