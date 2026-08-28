import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatMXN } from '@/lib/utils';
import { ConnectStripeButton, StripeLoginButton } from './EarningsActions';

export default async function EarningsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/');

    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', user.id)
        .single();

    // Not connected — show onboarding CTA
    if (!profile?.stripe_onboarding_complete || !profile.stripe_account_id) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-16 text-center">
                <h1 className="text-2xl font-bold mb-3">Mis ingresos</h1>
                <p className="text-gray-500 text-sm mb-8">
                    Conecta tu cuenta de Stripe para recibir pagos y ver tus ingresos.
                </p>
                <ConnectStripeButton />
            </div>
        );
    }

    // Fetch Stripe data — each call has a .catch so one failure doesn't crash the page
    const [balance, transactions, payouts] = await Promise.all([
        stripe.balance.retrieve({}, { stripeAccount: profile.stripe_account_id }).catch(() => null),
        stripe.balanceTransactions.list(
            { limit: 20, type: 'payment' },
            { stripeAccount: profile.stripe_account_id }
        ).catch(() => null),
        stripe.payouts.list(
            { limit: 10 },
            { stripeAccount: profile.stripe_account_id }
        ).catch(() => null),
    ]);

    if (!balance) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-16 text-center">
                <h1 className="text-2xl font-bold mb-3">Mis ingresos</h1>
                <p className="text-red-500 text-sm">
                    Error al cargar datos de Stripe. Intenta de nuevo más tarde.
                </p>
            </div>
        );
    }

    const availableCents = balance.available.find(b => b.currency === 'mxn')?.amount ?? 0;
    const pendingCents   = balance.pending.find(b => b.currency === 'mxn')?.amount ?? 0;

    const payoutStatusLabel: Record<string, string> = {
        paid:       'Depositado',
        in_transit: 'En camino',
        pending:    'Pendiente',
        failed:     'Fallido',
        canceled:   'Cancelado',
    };
    const payoutStatusColor: Record<string, string> = {
        paid:       'bg-emerald-900/50 text-emerald-400',
        in_transit: 'bg-yellow-900/50 text-yellow-400',
        pending:    'bg-gray-800 text-gray-500',
        failed:     'bg-red-900/50 text-red-400',
        canceled:   'bg-red-900/50 text-red-400',
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white mb-1 inline-block transition-colors">
                        ← Mis eventos
                    </Link>
                    <h1 className="text-2xl font-bold">Mis ingresos</h1>
                </div>
                <StripeLoginButton />
            </div>

            {/* Balance cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <p className="text-xs text-gray-500 mb-1">Disponible</p>
                    <p className="text-2xl font-bold">{formatMXN(availableCents / 100)}</p>
                    <p className="text-xs text-gray-400 mt-1">Listo para depositar</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <p className="text-xs text-gray-500 mb-1">En tránsito</p>
                    <p className="text-2xl font-bold">{formatMXN(pendingCents / 100)}</p>
                    <p className="text-xs text-gray-400 mt-1">Liquidación T+2 días hábiles</p>
                </div>
            </div>

            {/* Recent charges */}
            <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-300 mb-3">Cobros recientes</h2>
                {!transactions?.data.length ? (
                    <p className="text-sm text-gray-500 py-6 text-center border border-gray-800 rounded-lg">
                        Aún no hay cobros registrados.
                    </p>
                ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-800 bg-gray-800/50">
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Fecha</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400">Bruto</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400">Comisiones</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400">Neto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.data.map((tx) => (
                                    <tr key={tx.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                                        <td className="px-4 py-3 text-gray-400">
                                            {new Date(tx.created * 1000).toLocaleDateString('es-MX', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatMXN(tx.amount / 100)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            −{formatMXN(tx.fee / 100)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatMXN(tx.net / 100)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payouts */}
            <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-3">Depósitos a tu cuenta</h2>
                {!payouts?.data.length ? (
                    <p className="text-sm text-gray-500 py-6 text-center border border-gray-800 rounded-lg">
                        Aún no hay depósitos. El saldo disponible se deposita automáticamente.
                    </p>
                ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-800 bg-gray-800/50">
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Fecha de llegada</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400">Monto</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 pl-6">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.data.map((payout) => (
                                    <tr key={payout.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                                        <td className="px-4 py-3 text-gray-400">
                                            {new Date(payout.arrival_date * 1000).toLocaleDateString('es-MX', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatMXN(payout.amount / 100)}
                                        </td>
                                        <td className="px-4 py-3 pl-6">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${payoutStatusColor[payout.status] ?? 'bg-gray-800 text-gray-500'}`}>
                                                {payoutStatusLabel[payout.status] ?? payout.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
