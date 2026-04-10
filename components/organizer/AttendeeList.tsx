import type { Ticket } from '@/lib/supabase/types';
import { Badge } from '@/components/ui/Badge';

type AttendeeListProps = { tickets: Ticket[] };

const statusColor: Record<Ticket['status'], 'green' | 'gray' | 'red' | 'blue'> = {
  active: 'green',
  redeemed: 'gray',
  cancelled: 'red',
  transferred: 'blue',
};

export function AttendeeList({ tickets }: AttendeeListProps) {
  if (!tickets.length) return <p className="text-sm text-gray-500">Sin asistentes aún.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 font-semibold text-gray-600">Correo</th>
            <th className="pb-2 font-semibold text-gray-600">Tipo</th>
            <th className="pb-2 font-semibold text-gray-600">Estado</th>
            <th className="pb-2 font-semibold text-gray-600">Canjeado</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 text-gray-900">{ticket.buyer_email}</td>
              <td className="py-2 text-gray-600">{ticket.ticket_type}</td>
              <td className="py-2">
                <Badge color={statusColor[ticket.status]}>{ticket.status}</Badge>
              </td>
              <td className="py-2 text-gray-500 text-xs">
                {ticket.redeemed_at
                  ? new Date(ticket.redeemed_at).toLocaleString('es-MX')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
