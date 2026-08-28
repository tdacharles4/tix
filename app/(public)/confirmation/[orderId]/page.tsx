'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatMXN, formatDate } from '@/lib/utils';
import type { Order, Ticket } from '@/lib/supabase/types';

type EventSummary = { title: string; date: string; venue: string | null };
type TicketWithQR = Ticket & { qr_image?: string };

export default function ConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();

  const [order,    setOrder]    = useState<Order | null>(null);
  const [event,    setEvent]    = useState<EventSummary | null>(null);
  const [tickets,  setTickets]  = useState<TicketWithQR[]>([]);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [verified,   setVerified]   = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    let attempts = 0;
    const MAX = 10;

    async function poll() {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) { setNotFound(true); setFetching(false); return; }
      const data = await res.json();
      setOrder(data.order);
      setEvent(data.event);
      setTickets(data.tickets);
      setFetching(false);

      // Keep polling until paid or we've tried MAX times (~20s)
      if (data.order?.status !== 'paid' && attempts < MAX) {
        attempts++;
        setTimeout(poll, 2000);
      }
    }

    poll();
  }, [orderId]);

  function handleEmailVerify(e: React.FormEvent) {
    e.preventDefault();
    if (emailInput.toLowerCase().trim() === order?.buyer_email.toLowerCase()) {
      setVerified(true);
      setEmailError('');
    } else {
      setEmailError('El correo no coincide con el de la compra.');
    }
  }

  if (fetching)  return <div className="p-8 text-gray-400">Cargando…</div>;
  if (notFound)  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-bold mb-2">Orden no encontrada</h1>
      <p className="text-gray-400 text-sm">El número de orden no existe o el enlace es incorrecto.</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">
          {order?.status === 'paid' ? '¡Compra exitosa!' : 'Pago pendiente'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {order?.status === 'paid'
            ? 'Tus boletos han sido enviados a tu correo.'
            : 'Tu pago está siendo procesado.'}
        </p>
      </div>

      {/* Order summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3">{event?.title}</h2>
        {event?.date  && <p className="text-sm text-gray-400 mb-1">{formatDate(event.date)}</p>}
        {event?.venue && <p className="text-sm text-gray-400 mb-3">{event.venue}</p>}
        <div className="flex justify-between text-sm border-t border-gray-800 pt-3">
          <span className="text-gray-400">{order?.quantity} boleto{(order?.quantity ?? 0) > 1 ? 's' : ''}</span>
          <span className="font-semibold">{formatMXN(order?.total_mxn ?? order?.amount_mxn ?? 0)}</span>
        </div>
      </div>

      {/* Tickets — behind email gate */}
      {order?.status === 'paid' && tickets.length > 0 && (
        <>
          {!verified ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h2 className="font-semibold mb-1">Ver tus boletos</h2>
              <p className="text-sm text-gray-400 mb-4">
                Ingresa el correo que usaste al comprar para acceder a tus boletos.
              </p>
              <form onSubmit={handleEmailVerify} className="space-y-3">
                <input type="email" required placeholder="correo@ejemplo.com"
                  value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
                <button type="submit"
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                  Ver boletos
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold">
                Tu{tickets.length > 1 ? 's' : ''} boleto{tickets.length > 1 ? 's' : ''}
              </h2>
              {tickets.map((ticket, i) => (
                <div key={ticket.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Boleto {i + 1} de {tickets.length}
                  </p>
                  {ticket.holder_name && (
                    <p className="text-sm font-semibold mb-1">{ticket.holder_name}</p>
                  )}
                  <p className="text-xs text-gray-400 mb-3">{ticket.ticket_type}</p>
                  {ticket.qr_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ticket.qr_image} alt={`QR boleto ${ticket.id}`} className="w-48 h-48 mx-auto mb-3" />
                  )}
                  <p className="text-xs text-gray-400 font-mono">{ticket.id}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {order?.status === 'pending' && (
        <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4 text-sm text-yellow-400 text-center">
          Recibirás tus boletos por correo una vez que confirmemos el pago.
        </div>
      )}
    </div>
  );
}
