'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Scanner = { id: string; username: string; created_at: string };

type FormState = 'idle' | 'creating' | 'changing-password';

export default function ScannersPage() {
  const [scanners,       setScanners]       = useState<Scanner[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [formState,      setFormState]      = useState<FormState>('idle');
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');

  // Create form fields
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirm,  setNewConfirm]  = useState('');

  // Change password fields
  const [changePassword, setChangePassword] = useState('');
  const [changeConfirm,  setChangeConfirm]  = useState('');

  async function fetchScanners() {
    const res = await fetch('/api/organizer/scanners');
    const data = await res.json();
    setScanners(data.scanners ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchScanners(); }, []);

  function resetForms() {
    setFormState('idle');
    setSelectedId(null);
    setNewUsername('');
    setNewPassword('');
    setNewConfirm('');
    setChangePassword('');
    setChangeConfirm('');
    setError('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== newConfirm) { setError('Las contraseñas no coinciden'); return; }

    const res = await fetch('/api/organizer/scanners', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: newUsername, password: newPassword }),
    });
    const data = await res.json();

    if (!res.ok) { setError(data.error ?? 'Error al crear escáner'); return; }

    setScanners((prev) => [...prev, data.scanner]);
    setSuccess(`Escáner "${data.scanner.username}" creado.`);
    resetForms();
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (changePassword !== changeConfirm) { setError('Las contraseñas no coinciden'); return; }

    const res = await fetch(`/api/organizer/scanners/${selectedId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: changePassword }),
    });
    const data = await res.json();

    if (!res.ok) { setError(data.error ?? 'Error al cambiar contraseña'); return; }

    setSuccess('Contraseña actualizada.');
    resetForms();
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/organizer/scanners/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Error al eliminar escáner'); return; }
    setScanners((prev) => prev.filter((s) => s.id !== id));
    setConfirmDelete(null);
    setSuccess('Escáner eliminado.');
    setTimeout(() => setSuccess(''), 3000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white mb-1 inline-block transition-colors">
            ← Mis eventos
          </Link>
          <h1 className="text-2xl font-bold">Escáneres</h1>
        </div>
        {formState === 'idle' && (
          <button
            onClick={() => setFormState('creating')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Nuevo escáner
          </button>
        )}
      </div>

      {/* Success / Error banners */}
      {success && (
        <div className="bg-emerald-900/30 border border-emerald-800 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-4">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Create form */}
      {formState === 'creating' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">Nuevo escáner</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Nombre de usuario <span className="text-gray-400">(letras, números y _)</span>
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="puerta_1"
                pattern="[a-zA-Z0-9_]{3,30}"
                className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Confirmar contraseña</label>
              <input
                type="password"
                required
                value={newConfirm}
                onChange={(e) => setNewConfirm(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  newConfirm && newConfirm !== newPassword
                    ? 'border-red-400'
                    : 'border-gray-700'
                }`}
              />
              {newConfirm && newConfirm !== newPassword && (
                <p className="text-red-500 text-xs mt-1">Las contraseñas no coinciden</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!newUsername || newPassword.length < 8 || newPassword !== newConfirm}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                Crear
              </button>
              <button
                type="button"
                onClick={resetForms}
                className="text-gray-400 text-sm hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scanner list */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Cargando…</p>
      ) : scanners.length === 0 && formState !== 'creating' ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-400 text-sm mb-1">Aún no tienes escáneres.</p>
          <p className="text-gray-500 text-xs">Crea uno para que tu equipo pueda escanear boletos en la entrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scanners.map((scanner) => (
            <div key={scanner.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              {/* Change password form inline */}
              {formState === 'changing-password' && selectedId === scanner.id ? (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <p className="text-sm font-semibold">
                    Cambiar contraseña — <span className="font-mono">{scanner.username}</span>
                  </p>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nueva contraseña</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={changePassword}
                      onChange={(e) => setChangePassword(e.target.value)}
                      className="w-full border border-gray-700 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Confirmar contraseña</label>
                    <input
                      type="password"
                      required
                      value={changeConfirm}
                      onChange={(e) => setChangeConfirm(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        changeConfirm && changeConfirm !== changePassword
                          ? 'border-red-400'
                          : 'border-gray-700'
                      }`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={changePassword.length < 8 || changePassword !== changeConfirm}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={resetForms} className="text-gray-400 text-sm hover:text-white">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold font-mono">{scanner.username}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Creado {formatDate(scanner.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {confirmDelete === scanner.id ? (
                      <>
                        <span className="text-xs text-gray-500">¿Eliminar?</span>
                        <button
                          onClick={() => handleDelete(scanner.id)}
                          className="text-red-400 text-xs font-medium hover:text-red-300"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-gray-500 text-xs hover:text-gray-300"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setFormState('changing-password'); setSelectedId(scanner.id); setError(''); }}
                          className="text-indigo-400 text-xs hover:underline"
                        >
                          Cambiar contraseña
                        </button>
                        <button
                          onClick={() => setConfirmDelete(scanner.id)}
                          className="text-gray-400 text-xs hover:text-red-500"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
        <p className="font-semibold text-gray-300 mb-1">¿Cómo usar los escáneres?</p>
        Tu equipo inicia sesión en{' '}
        <span className="font-mono text-gray-300">
          {process.env.NEXT_PUBLIC_SCANNER_HOST ?? 'scan.localhost:3000'}
        </span>{' '}
        con su usuario y contraseña. Solo tienen acceso al panel de escaneo — no pueden ver tu cuenta, eventos ni datos financieros.
      </div>
    </div>
  );
}
