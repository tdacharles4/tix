import type { Order } from '@/lib/supabase/types';
import { formatMXN } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

type SalesTableProps = { orders: Order[] };

const statusColor: Record<Order['status'], 'green' | 'yellow' | 'red' | 'gray'> = {
  paid: 'green',
  pending: 'yellow',
  failed: 'red',
  refunded: 'gray',
};

export function SalesTable({ orders }: SalesTableProps) {
  if (!orders.length) return <p className="text-sm text-gray-500">Sin ventas aún.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 font-semibold text-gray-600">Comprador</th>
            <th className="pb-2 font-semibold text-gray-600">Correo</th>
            <th className="pb-2 font-semibold text-gray-600 text-right">Cant.</th>
            <th className="pb-2 font-semibold text-gray-600 text-right">Total</th>
            <th className="pb-2 font-semibold text-gray-600">Estado</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 text-gray-900">{order.buyer_name}</td>
              <td className="py-2 text-gray-600">{order.buyer_email}</td>
              <td className="py-2 text-right">{order.quantity}</td>
              <td className="py-2 text-right">{formatMXN(order.amount_mxn)}</td>
              <td className="py-2">
                <Badge color={statusColor[order.status]}>{order.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
