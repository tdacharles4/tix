'use client';

import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  async function handleGoogleLogin() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('redirectTo') ?? '/dashboard';
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto">
        <span className="text-lg font-bold tracking-tight">Climate Control</span>
        <button
          onClick={handleGoogleLogin}
          className="flex items-center gap-2.5 bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Acceder con Google
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-20 pb-28 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Vende boletos.<br />
          <span className="text-indigo-400">Sin complicaciones.</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          La plataforma de boletos para eventos en México. Cobra directo a tu cuenta, escanea en la puerta, y ten el control total de tus ventas.
        </p>
        <button
          onClick={handleGoogleLogin}
          className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors"
        >
          Comenzar gratis
        </button>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pb-28">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Cobro directo</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              El dinero llega directo a tu cuenta de Stripe. Sin intermediarios, sin retenciones, sin esperas.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Escaneo en puerta</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tu equipo escanea QR desde el celular. Sin apps, sin descargas. Dashboard en tiempo real con conteo de asistentes.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7">
            <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Analytics completo</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Visualiza tus ventas por fase, tipo de boleto y fecha. Exporta listas de asistentes en un clic.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pb-28">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Precio simple</h2>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            Sin suscripciones mensuales. Solo pagas cuando vendes.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm uppercase tracking-wider mb-3">Por transacción</p>
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="text-5xl font-extrabold text-white">10%</span>
            <span className="text-gray-500 text-lg">+ Stripe</span>
          </div>
          <p className="text-gray-500 text-sm mb-8">
            Comisión de plataforma sobre el precio del boleto. Las comisiones de Stripe se calculan aparte.
          </p>
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Crear mi primer evento
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-gray-600 text-sm">© {new Date().getFullYear()} Climate Control</span>
          <div className="flex gap-6">
            <a href="mailto:soporte@climatecontrol.mx" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
