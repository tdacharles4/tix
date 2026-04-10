type RedemptionStatusProps = {
  valid: boolean;
  buyerName?: string;
  buyerEmail?: string;
  ticketType?: string;
  seatLabel?: string | null;
  reason?: string;
  onScanAnother: () => void;
};

const reasonLabels: Record<string, string> = {
  already_redeemed: 'Ya fue canjeado',
  cancelled: 'Boleto cancelado',
  transferred: 'Boleto transferido',
  not_found: 'Boleto no encontrado',
};

export function RedemptionStatus({
  valid,
  buyerName,
  buyerEmail,
  ticketType,
  seatLabel,
  reason,
  onScanAnother,
}: RedemptionStatusProps) {
  return (
    <div className={`rounded-xl border p-5 ${valid ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
      {valid ? (
        <div className="text-gray-900">
          <p className="font-bold text-green-800 text-lg mb-1">✓ Válido</p>
          {buyerName && <p className="font-semibold">{buyerName}</p>}
          {buyerEmail && <p className="text-sm text-gray-600">{buyerEmail}</p>}
          {ticketType && (
            <p className="text-sm text-gray-600 mt-1">
              {ticketType}{seatLabel ? ` · Asiento ${seatLabel}` : ''}
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className="font-bold text-red-800 text-lg mb-1">✗ No válido</p>
          <p className="text-sm text-red-700">{reason ? (reasonLabels[reason] ?? reason) : 'Error desconocido'}</p>
        </div>
      )}
      <button
        onClick={onScanAnother}
        className="mt-4 w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-100"
      >
        Escanear otro
      </button>
    </div>
  );
}
