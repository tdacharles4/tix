'use client';

import { useState } from 'react';

export function ConnectStripeButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    async function handleConnect() {
        setLoading(true);
        setError('');
        try {
            const res  = await fetch('/api/stripe/connect', { method: 'POST' });
            const data = await res.json();
            if (data.alreadyConnected) { window.location.reload(); return; }
            if (data.url)              { window.open(data.url, '_blank', 'noopener'); setLoading(false); return; }
            setError('Error al conectar con Stripe. Intenta de nuevo.');
        } catch {
            setError('Error de conexión.');
        }
        setLoading(false);
    }

    return (
        <div>
            <button
                onClick={handleConnect}
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
                {loading ? 'Cargando…' : 'Conectar cuenta de pagos'}
            </button>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
    );
}

export function StripeLoginButton() {
    const [loading, setLoading] = useState(false);

    async function handleClick() {
        setLoading(true);
        try {
            const res  = await fetch('/api/stripe/login-link');
            const data = await res.json();
            if (data.url) { window.open(data.url, '_blank', 'noopener'); setLoading(false); return; }
        } catch { /* fall through */ }
        setLoading(false);
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="text-sm text-indigo-400 hover:underline disabled:opacity-50"
        >
            {loading ? 'Cargando…' : 'Gestionar cuenta en Stripe →'}
        </button>
    );
}
