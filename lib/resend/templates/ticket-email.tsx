import * as React from 'react';
import type { Event, Ticket } from '@/lib/supabase/types';

type TicketEmailProps = {
  event: Event;
  ticket: Ticket;
  buyerName: string;
  qrCodeBase64: string; // data:image/png;base64,...
};

export function TicketEmail({ event, ticket, buyerName, qrCodeBase64 }: TicketEmailProps) {
  const eventDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(event.date));

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Tu boleto — {event.title}</title>
      </head>
      <body
        style={{
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          backgroundColor: '#f5f5f5',
          margin: 0,
          padding: '32px 16px',
        }}
      >
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ maxWidth: 520, margin: '0 auto' }}
        >
          {/* Header */}
          <tr>
            <td
              style={{
                backgroundColor: '#1a1a2e',
                borderRadius: '12px 12px 0 0',
                padding: '32px',
                textAlign: 'center',
              }}
            >
              <p style={{ color: '#a78bfa', margin: 0, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
                Tu boleto
              </p>
              <h1 style={{ color: '#ffffff', margin: '8px 0 0', fontSize: 26, fontWeight: 700 }}>
                {event.title}
              </h1>
            </td>
          </tr>

          {/* Body */}
          <tr>
            <td
              style={{
                backgroundColor: '#ffffff',
                padding: '32px',
                borderLeft: '1px solid #e5e7eb',
                borderRight: '1px solid #e5e7eb',
              }}
            >
              <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: 13 }}>Hola,</p>
              <p style={{ margin: '0 0 24px', color: '#111827', fontSize: 16, fontWeight: 600 }}>
                {buyerName}
              </p>

              <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
                <tr>
                  <td style={{ paddingBottom: 12 }}>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Fecha y hora
                    </p>
                    <p style={{ margin: '2px 0 0', color: '#111827', fontSize: 15 }}>{eventDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: 12 }}>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Lugar
                    </p>
                    <p style={{ margin: '2px 0 0', color: '#111827', fontSize: 15 }}>{event.venue}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Tipo de boleto
                    </p>
                    <p style={{ margin: '2px 0 0', color: '#111827', fontSize: 15 }}>
                      {ticket.ticket_type.charAt(0).toUpperCase() + ticket.ticket_type.slice(1)}
                      {ticket.seat_label ? ` — Asiento ${ticket.seat_label}` : ''}
                    </p>
                  </td>
                </tr>
              </table>

              {/* QR Code */}
              <table width="100%" cellPadding={0} cellSpacing={0}>
                <tr>
                  <td style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: 16,
                        backgroundColor: '#ffffff',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeBase64}
                        alt="QR de acceso"
                        width={200}
                        height={200}
                        style={{ display: 'block' }}
                      />
                    </div>
                    <p style={{ margin: '12px 0 0', color: '#9ca3af', fontSize: 11 }}>
                      Presenta este código en la entrada
                    </p>
                  </td>
                </tr>
              </table>

              {/* Ticket ID */}
              <div
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: 0, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  ID de boleto
                </p>
                <p style={{ margin: '4px 0 0', color: '#374151', fontSize: 13, fontFamily: 'monospace' }}>
                  {ticket.id}
                </p>
              </div>
            </td>
          </tr>

          {/* Footer */}
          <tr>
            <td
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0 0 12px 12px',
                border: '1px solid #e5e7eb',
                borderTop: 'none',
                padding: '20px 32px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, color: '#9ca3af', fontSize: 12 }}>
                Este boleto es personal e intransferible. No compartas tu código QR.
              </p>
              {/* TODO: SAT CFDI invoicing link would go here */}
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}

export default TicketEmail;
