'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

type QRScannerProps = {
  onScan: (ticketId: string) => void;
};

export function QRScanner({ onScan }: QRScannerProps) {
  const [active, setActive] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const lastRef = useRef('');

  async function start() {
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-scanner-container');
    scannerRef.current = scanner;
    setActive(true);

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decoded: string) => {
        if (decoded !== lastRef.current) {
          lastRef.current = decoded;
          onScan(decoded);
        }
      },
      () => {}
    );
  }

  async function stop() {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setActive(false);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="qr-scanner-container"
        className="w-full max-w-xs rounded-xl overflow-hidden bg-black"
        style={{ minHeight: 280 }}
      />
      {!active ? (
        <Button onClick={start}>Iniciar escáner</Button>
      ) : (
        <Button variant="secondary" onClick={stop}>Detener</Button>
      )}
    </div>
  );
}
