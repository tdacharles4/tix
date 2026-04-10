'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Event } from '@/lib/supabase/types';
import { formatMXN } from '@/lib/utils';

const PLATFORM_FEE = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_MXN ?? 20);

export default function CheckoutPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentError = searchParams.get('error');

  const [event, setEvent] = useState<Event | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(paymentError ? 'El pago fue rechazado. Intenta de nuevo.' : '');

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('status', 'live')
        .single();

      setEvent(data);
    }
    load();
  }, [eventId]);

  const subtotal = (event?.price_mxn ?? 0) * quantity;
  const fee = PLATFORM_FEE * quantity;
  const total = subtotal + fee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, quantity, buyerName, buyerEmail, buyerPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al procesar el pago');
        setLoading(false);
        return;
      }

      // Redirect to Conekta hosted checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(`/confirmation/${data.orderId}`);
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  }

  if (!event) return <div className="p-8 text-gray-500">Cargando evento…</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Comprar boleto</h1>
      <p className="text-gray-500 text-sm mb-6">{event.title}</p>

      {/* Order summary */}
      <div className="border border-gray-200 rounded-lg p-4 mb-6 text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Precio × {quantity}</span>
          <span>{formatMXN(subtotal)}</span>
        </div>
        <div className="flex justify-between mb-2 text-gray-500">
          <span>Cargo por servicio</span>
          <span>{formatMXN(fee)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-gray-100 pt-2 mt-2">
          <span>Total</span>
          <span>{formatMXN(total)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de boletos</label>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
          <input
            type="text"
            required
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
          <input
            type="email"
            required
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
          <input
            type="tel"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Conekta.js card widget mounts here — currently shows hosted redirect flow */}
        {/* TODO: optionally embed Conekta.js tokenizer here for inline card entry */}
        {/* <div id="conekta-payment-form" /> */}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Procesando…' : `Pagar ${formatMXN(total)}`}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Serás redirigido al checkout seguro de Conekta. Aceptamos tarjeta, OXXO y SPEI.
        </p>
      </form>
    </div>
  );
}
