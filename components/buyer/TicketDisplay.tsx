type TicketDisplayProps = {
  ticketId: string;
  qrDataUrl: string;
  eventTitle: string;
  ticketType: string;
  seatLabel?: string | null;
};

export function TicketDisplay({ ticketId, qrDataUrl, eventTitle, ticketType, seatLabel }: TicketDisplayProps) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 text-center">
      <p className="font-semibold text-gray-900 mb-1">{eventTitle}</p>
      <p className="text-sm text-gray-500 mb-4">
        {ticketType}{seatLabel ? ` · Asiento ${seatLabel}` : ''}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR de acceso" className="w-48 h-48 mx-auto mb-3" />
      <p className="text-xs text-gray-400 font-mono">{ticketId}</p>
    </div>
  );
}
