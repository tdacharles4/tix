import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPlatformFee(unitPrice: number, quantity: number): number {
  const pct = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT ?? 10) / 100;
  // Ceil to nearest centavo so we never round down
  return Math.ceil(unitPrice * quantity * pct * 100) / 100;
}


export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}
