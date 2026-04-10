import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { formatMXN, formatDate } from '@/lib/utils';
import { generateQRCode } from '@/lib/qr/generate';

type Props = { params: Promise<{ orderId: string }> };

export default async function ConfirmationPage({ params }: Props) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const uid = user!.id;

  const { data: orderData } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('buyer_id', uid)
    .single();

  if (!orderData) notFound();
  const order = orderData!;

  const { data: eventData } = await supabase
    .from('events')
    .select('*')
    .eq('id', order.event_id)
    .single();

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', orderId);

  const event = eventData;

  // Generate QR codes for display (tickets with paid status)
  const ticketsWithQR = await Promise.all(
    (tickets ?? []).map(async (ticket) => ({
      ...ticket,
      qrDataUrl: await generateQRCode(ticket.id),
    }))
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {order.status === 'paid' ? '¡Compra exitosa!' : 'Pago pendiente'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {order.status === 'paid'
            ? 'Tus boletos han sido enviados a tu correo.'
            : 'Tu pago está siendo procesado.'}
        </p>
      </div>

      {/* Order summary */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">{event?.title}</h2>
        {event?.date && (
          <p className="text-sm text-gray-600 mb-1">{formatDate(event.date)}</p>
        )}
        {event?.venue && (
          <p className="text-sm text-gray-600 mb-3">{event.venue}</p>
        )}
        <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
          <span className="text-gray-600">{order.quantity} boleto{order.quantity > 1 ? 's' : ''}</span>
          <span className="font-semibold">{formatMXN(order.amount_mxn)}</span>
        </div>
      </div>

      {/* Tickets */}
      {ticketsWithQR.length > 0 && order.status === 'paid' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">
            Tu{ticketsWithQR.length > 1 ? 's' : ''} boleto{ticketsWithQR.length > 1 ? 's' : ''}
          </h2>
          {ticketsWithQR.map((ticket, i) => (
            <div key={ticket.id} className="border border-gray-200 rounded-lg p-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                Boleto {i + 1} de {ticketsWithQR.length}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ticket.qrDataUrl}
                alt={`QR boleto ${ticket.id}`}
                className="w-48 h-48 mx-auto mb-3"
              />
              <p className="text-xs text-gray-400 font-mono">{ticket.id}</p>
            </div>
          ))}
        </div>
      )}

      {order.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 text-center">
          Recibirás tus boletos por correo una vez que confirmemos el pago.
        </div>
      )}

      {/* TODO: SAT CFDI — link to request invoice would appear here */}
    </div>
  );
}
