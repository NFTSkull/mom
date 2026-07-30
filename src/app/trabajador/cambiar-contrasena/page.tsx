"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TrabajadorCambiarContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/trabajador/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message || "No se pudo actualizar la contraseña.");
        return;
      }
      router.replace("/trabajador");
    } catch {
      setError("No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Cambiar contraseña</h1>
      <p className="mt-1 text-sm text-slate-600">
        Debe establecer una contraseña nueva antes de continuar. Use mayúscula, minúscula, número y
        símbolo (mínimo 10 caracteres).
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Nueva contraseña
          <input
            data-testid="worker-new-password"
            type="password"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Confirmar contraseña
          <input
            data-testid="worker-confirm-password"
            type="password"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error ? (
          <p data-testid="worker-password-error" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          data-testid="worker-password-submit"
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          Guardar contraseña
        </button>
      </form>
    </section>
  );
}
