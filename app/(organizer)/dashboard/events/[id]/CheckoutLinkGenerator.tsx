'use client';

import { useState } from 'react';

type Props = { eventId: string };

export default function CheckoutLinkGenerator({ eventId }: Props) {
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${eventId}`
    : `/events/${eventId}`;

  function handleCopy() {
    navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="border border-indigo-500/50 text-indigo-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-900/30 transition-colors"
    >
      {copied ? '¡Enlace copiado!' : 'Copiar enlace de venta'}
    </button>
  );
}
