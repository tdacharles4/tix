'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMXN } from '@/lib/utils';

type CheckoutFormProps = {
  total: number;
  onSubmit: (values: { buyerName: string; buyerEmail: string; buyerPhone: string; quantity: number }) => void;
  loading?: boolean;
  error?: string;
  defaultEmail?: string;
};

export function CheckoutForm({ total, onSubmit, loading, error, defaultEmail }: CheckoutFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      buyerName: fd.get('buyerName') as string,
      buyerEmail: fd.get('buyerEmail') as string,
      buyerPhone: fd.get('buyerPhone') as string,
      quantity: Number(fd.get('quantity')),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Número de boletos</label>
        <select
          name="quantity"
          defaultValue={1}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <Input label="Nombre completo *" name="buyerName" required />
      <Input label="Correo electrónico *" name="buyerEmail" type="email" required defaultValue={defaultEmail} />
      <Input label="Teléfono (opcional)" name="buyerPhone" type="tel" />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full py-3">
        {loading ? 'Procesando…' : `Pagar ${formatMXN(total)}`}
      </Button>
    </form>
  );
}
