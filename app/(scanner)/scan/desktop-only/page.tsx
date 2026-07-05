export default function DesktopOnlyPage() {
  const scanUrl = process.env.NEXT_PUBLIC_SCANNER_HOST
    ? `https://${process.env.NEXT_PUBLIC_SCANNER_HOST}/scan/login`
    : 'scan.localhost:3000/scan/login';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      {/* Phone icon */}
      <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 15.75h3" />
        </svg>
      </div>

      <h1 className="text-white text-2xl font-bold mb-3">Solo para móvil</h1>
      <p className="text-gray-400 text-base mb-8 max-w-xs leading-relaxed">
        El panel de escaneo está diseñado para usarse en un teléfono. Abre este enlace desde tu celular:
      </p>

      <div className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-3">
        <p className="text-indigo-300 font-mono text-sm">{scanUrl}</p>
      </div>
    </div>
  );
}
