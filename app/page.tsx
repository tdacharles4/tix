import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-8">
      <h1 className="text-4xl font-bold text-gray-900">Boletera</h1>
      <p className="text-gray-500 max-w-sm">
        Plataforma de venta de boletos para eventos en México.
      </p>
      <div className="flex gap-3 mt-4">
        <Link
          href="/login"
          className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/register"
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
