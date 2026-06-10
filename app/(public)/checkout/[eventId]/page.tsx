'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Event } from '@/lib/supabase/types';
import { formatMXN } from '@/lib/utils';

const PLATFORM_FEE = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_MXN ?? 20);

export default function CheckoutPage() {
  const { eventId }  = useParams<{ eventId: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get('token');
  const paymentError = searchParams.get('error');

  const [event,       setEvent]       = useState<Event | null>(null);
  const [tokenValid,  setTokenValid]  = useState<boolean | null>(null);
  const [tokenError,  setTokenError]  = useState('');
  const [quantity,    setQuantity]    = useState(1);
  const [buyerName,   setBuyerName]   = useState('');
  const [buyerEmail,  setBuyerEmail]  = useState('');
  const [buyerPhone,  setBuyerPhone]  = useState('');
  const [holderNames, setHolderNames] = useState<string[]>(['']);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(paymentError ? 'El pago fue rechazado. Intenta de nuevo.' : '');

  useEffect(() => {
    async function load() {
      if (!sessionToken) {
        setTokenValid(false);
        setTokenError('Enlace de compra inválido. Por favor regresa a la tienda del organizador.');
        return;
      }

      const res  = await fetch(`/api/checkout/session?token=${sessionToken}&eventId=${eventId}`);
      const json = await res.json();

      if (!json.valid) {
        setTokenValid(false);
        setTokenError(
          json.reason === 'Token expired'      ? 'Este enlace de compra ha expirado. Por favor regresa a la tienda.' :
          json.reason === 'Token already used' ? 'Este enlace ya fue utilizado para una compra.' :
          'Enlace de compra inválido.'
        );
        return;
      }

      setTokenValid(true);
      const qty = json.quantity ?? 1;
      setQuantity(qty);
      setHolderNames(Array.from({ length: qty }, () => ''));

      const supabase = createClient();
      const { data } = await supabase.from('events').select('*').eq('id', eventId).eq('status', 'live').single();
      setEvent(data);
    }
    load();
  }, [eventId, sessionToken]);

  // Sync holderNames array length with quantity
  function handleQuantityChange(qty: number) {
    setQuantity(qty);
    setHolderNames((prev) => {
      const next = [...prev];
      while (next.length < qty)  next.push('');
      while (next.length > qty)  next.pop();
      return next;
    });
  }

  function updateHolder(i: number, value: string) {
    setHolderNames((prev) => { const next = [...prev]; next[i] = value; return next; });
  }

  const subtotal = (event?.price_mxn ?? 0) * quantity;
  const fee      = PLATFORM_FEE * quantity;
  const total    = subtotal + fee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate all holder names are filled
    if (holderNames.some((n) => !n.trim())) {
      setError('Por favor ingresa el nombre de todos los titulares de boleto.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId, quantity, buyerName, buyerEmail, buyerPhone,
          sessionToken, holderNames,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al procesar el pago'); setLoading(false); return; }

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

  if (tokenValid === null) return <div className="p-8 text-gray-500">Verificando enlace…</div>;

  if (tokenValid === false) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace inválido</h1>
        <p className="text-gray-500 text-sm">{tokenError}</p>
      </div>
    );
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de boletos</label>
          <select value={quantity} onChange={(e) => handleQuantityChange(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Buyer info */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Información del comprador</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nombre completo *</label>
            <input type="text" required value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Correo electrónico *</label>
            <input type="email" required value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Teléfono (opcional)</label>
            <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        {/* Holder names — one per ticket */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Titular{quantity > 1 ? 'es' : ''} de boleto
          </h3>
          {holderNames.map((name, i) => (
            <div key={i}>
              <label className="block text-xs text-gray-500 mb-1">
                Boleto {i + 1}{quantity === 1 ? '' : ` de ${quantity}`} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => updateHolder(i, e.target.value)}
                placeholder="Nombre completo del titular"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
          {quantity > 1 && (
            <p className="text-xs text-gray-400">Cada boleto debe estar a nombre de su titular.</p>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Procesando…' : `Pagar ${formatMXN(total)}`}
        </button>

        <p className="text-xs text-gray-400 text-center">Pago seguro. Aceptamos tarjeta, OXXO y SPEI.</p>
      </form>
    </div>
  );
}
