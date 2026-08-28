'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Event } from '@/lib/supabase/types';
import { formatMXN, getPlatformFee } from '@/lib/utils';
import { calculateStripeFees } from '@/lib/stripe/fees';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/* ── Countdown Timer ───────────────────────────────────────────────────── */
function CountdownTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft <= 120;

  return (
    <div className={`sticky top-0 z-40 px-4 py-2 text-center text-sm font-medium ${
      isLow ? 'bg-red-900/80 text-red-200' : 'bg-gray-800 text-gray-300'
    }`}>
      Tiempo restante: {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────── */
export default function CheckoutPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get('token');
  const paymentError = searchParams.get('error');

  const [event, setEvent] = useState<Event | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [ticketTypeName, setTicketTypeName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [holderNames, setHolderNames] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(paymentError ? 'El pago fue rechazado. Intenta de nuevo.' : '');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [checkoutFees, setCheckoutFees] = useState<{
    ticketSubtotalMxn: number;
    platformFeeMxn: number;
    stripeFeeMxn: number;
    totalMxn: number;
  } | null>(null);

  const handleExpire = useCallback(() => { setExpired(true); }, []);

  useEffect(() => {
    async function load() {
      if (!sessionToken) {
        setTokenValid(false);
        setTokenError('Enlace de compra inválido. Por favor regresa a la página del evento.');
        return;
      }

      const res = await fetch(`/api/checkout/session?token=${sessionToken}&eventId=${eventId}`);
      const json = await res.json();

      if (!json.valid) {
        setTokenValid(false);
        setTokenError(
          json.reason === 'Token expired' ? 'Tu sesión de compra ha expirado. Por favor regresa al evento e inténtalo de nuevo.' :
          json.reason === 'Token already used' ? 'Este enlace ya fue utilizado para una compra.' :
          'Enlace de compra inválido.'
        );
        return;
      }

      setTokenValid(true);
      setExpiresAt(json.expiresAt);
      const qty = json.quantity ?? 1;
      setQuantity(qty);
      setHolderNames(Array.from({ length: qty }, () => ''));

      const supabase = createClient();
      const { data } = await supabase.from('events').select('*').eq('id', eventId).eq('status', 'live').single();
      setEvent(data);

      // Fetch ticket type config price if applicable
      if (json.ticketTypeConfigId) {
        const { data: tc } = await supabase
          .from('ticket_type_configs')
          .select('name, price_mxn')
          .eq('id', json.ticketTypeConfigId)
          .single();
        if (tc) {
          setUnitPrice(tc.price_mxn);
          setTicketTypeName(tc.name);
        }
      }
    }
    load();
  }, [eventId, sessionToken]);

  function handleQuantityChange(qty: number) {
    setQuantity(qty);
    setHolderNames((prev) => {
      const next = [...prev];
      while (next.length < qty) next.push('');
      while (next.length > qty) next.pop();
      return next;
    });
  }

  function updateHolder(i: number, value: string) {
    setHolderNames((prev) => { const next = [...prev]; next[i] = value; return next; });
  }

  const displayPrice = unitPrice ?? event?.price_mxn ?? 0;
  const subtotal = displayPrice * quantity;
  const fee = getPlatformFee(displayPrice, quantity);
  const { chargeCentavos, stripeFeeCentavos } = calculateStripeFees(
    Math.round(subtotal * 100),
    Math.round(fee * 100),
  );
  const stripeFee = stripeFeeCentavos / 100;
  const total = chargeCentavos / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (expired) { setError('Tu sesión ha expirado. Regresa al evento e intenta de nuevo.'); return; }
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

      setClientSecret(data.clientSecret);
      setCheckoutOrderId(data.orderId);
      setCheckoutFees(data.fees ?? null);
      setLoading(false);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  }

  function CheckoutForm({ orderId }: { orderId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState('');

    async function handlePay(e: React.FormEvent) {
      e.preventDefault();
      if (!stripe || !elements) return;
      setPaying(true);
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/confirmation/${orderId}`,
        },
      });
      if (error) {
        setPayError(error.message ?? 'El pago fue rechazado. Intenta de nuevo.');
        setPaying(false);
      }
    }

    return (
      <form onSubmit={handlePay} className="space-y-5">
        <PaymentElement />
        {payError && <p className="text-red-400 text-sm">{payError}</p>}
        <button type="submit" disabled={!stripe || paying}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
          {paying ? 'Procesando…' : 'Confirmar pago'}
        </button>
      </form>
    );
  }

  // Loading state
  if (tokenValid === null) return <div className="p-8 text-gray-400">Verificando enlace…</div>;

  // Invalid token
  if (tokenValid === false) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Enlace inválido</h1>
        <p className="text-gray-400 text-sm mb-4">{tokenError}</p>
        <a href={`/events/${eventId}`}
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Volver al evento
        </a>
      </div>
    );
  }

  // Expired session
  if (expired) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Sesión expirada</h1>
        <p className="text-gray-400 text-sm mb-4">Tu tiempo para completar la compra ha expirado.</p>
        <a href={`/events/${eventId}`}
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Volver al evento
        </a>
      </div>
    );
  }

  if (!event) return <div className="p-8 text-gray-400">Cargando evento…</div>;

  // Payment form (Stripe Elements)
  if (clientSecret && checkoutOrderId) {
    return (
      <div className="min-h-screen bg-gray-950">
        {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={handleExpire} />}
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold mb-1">Pago</h1>
          <p className="text-gray-400 text-sm mb-6">{event.title}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left — order summary */}
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm">
                <h3 className="font-semibold mb-3">Resumen</h3>
                <div className="flex justify-between mb-2 text-gray-400">
                  <span>Precio × {quantity}</span>
                  <span>{formatMXN(checkoutFees?.ticketSubtotalMxn ?? subtotal)}</span>
                </div>
                <div className="flex justify-between mb-2 text-gray-500">
                  <span>Cargo por servicio</span>
                  <span>{formatMXN(checkoutFees?.platformFeeMxn ?? fee)}</span>
                </div>
                <div className="flex justify-between mb-2 text-gray-500">
                  <span>Cargo por transacción</span>
                  <span>{formatMXN(checkoutFees?.stripeFeeMxn ?? stripeFee)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-gray-800 pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatMXN(checkoutFees?.totalMxn ?? total)}</span>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm">
                <h3 className="font-semibold mb-2">Comprador</h3>
                <p className="text-gray-300">{buyerName}</p>
                <p className="text-gray-500">{buyerEmail}</p>
              </div>

              {holderNames.some((n) => n.trim()) && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm">
                  <h3 className="font-semibold mb-2">
                    Titular{holderNames.length > 1 ? 'es' : ''} de boleto
                  </h3>
                  <ul className="space-y-1">
                    {holderNames.map((name, i) => (
                      <li key={i} className="text-gray-300">
                        {holderNames.length > 1 && (
                          <span className="text-gray-500 text-xs mr-1">{i + 1}.</span>
                        )}
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right — Stripe Elements */}
            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Método de pago</h2>
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#818cf8' } } }}>
                <CheckoutForm orderId={checkoutOrderId} />
              </Elements>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Buyer info form
  return (
    <div className="min-h-screen bg-gray-950">
      {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={handleExpire} />}
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Comprar boleto</h1>
        <p className="text-gray-400 text-sm mb-6">{event.title}</p>

        {/* Order summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 text-sm">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Precio × {quantity}</span>
            <span>{formatMXN(subtotal)}</span>
          </div>
          <div className="flex justify-between mb-2 text-gray-500">
            <span>Cargo por servicio</span>
            <span>{formatMXN(fee)}</span>
          </div>
          <div className="flex justify-between mb-2 text-gray-500">
            <span>Cargo por transacción</span>
            <span>{formatMXN(stripeFee)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-gray-800 pt-2 mt-2">
            <span>Total</span>
            <span>{formatMXN(total)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quantity — read-only since it was set on the event page */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Boletos</label>
            <p className="text-sm text-gray-400">{quantity} boleto{quantity > 1 ? 's' : ''}</p>
          </div>

          {/* Buyer info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300">Información del comprador</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre completo *</label>
              <input type="text" required value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Correo electrónico *</label>
              <input type="email" required value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
                className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Teléfono (opcional)</label>
              <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Holder names */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300">
              Titular{quantity > 1 ? 'es' : ''} de boleto
            </h3>
            {holderNames.map((name, i) => (
              <div key={i}>
                <label className="block text-xs text-gray-400 mb-1">
                  Boleto {i + 1}{quantity === 1 ? '' : ` de ${quantity}`} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => updateHolder(i, e.target.value)}
                  placeholder="Nombre completo del titular"
                  className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
            {quantity > 1 && (
              <p className="text-xs text-gray-400">Cada boleto debe estar a nombre de su titular.</p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Procesando…' : `Pagar ${formatMXN(total)}`}
          </button>

          <p className="text-xs text-gray-400 text-center">Pago seguro. Aceptamos tarjeta, OXXO y SPEI.</p>
        </form>
      </div>
    </div>
  );
}
